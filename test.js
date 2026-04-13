// whatsapp-api-server.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());
app.use(cors());

// ----------------------
// MongoDB Connection
// ----------------------
const MONGODB_URI = "mongodb://127.0.0.1:27017/whatsappapi";

// ----------------------
// Mongoose Schemas & Models
// ----------------------
const UserSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  name: { type: String, default: "User" },
  gender: { type: String, default: "Not Specified" },
  password: { type: String, required: true },
  userType: { type: String, enum: ["admin", "user"], default: "user" },
  createdAt: { type: Number, default: Date.now },
  validDays: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true }
});
const User = mongoose.model("User", UserSchema);

const StatSchema = new mongoose.Schema({
  totalMessagesSent: { type: Number, default: 0 }
});
const Stat = mongoose.model("Stat", StatSchema);

const TokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  userType: { type: String, required: true }
});
const Token = mongoose.model("Token", TokenSchema);

const TemplateSchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  content: { type: String, default: "" },
  buttons: { type: Array, default: [] },
  footer: { type: String, default: "" },
  header: { type: String, default: "" },
  sections: { type: Array, default: [] },
  mediaUrl: { type: String, default: "" },
  fileName: { type: String, default: "" }
});
const Template = mongoose.model("Template", TemplateSchema);

const PlanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  days: { type: Number, required: true },
  price: { type: Number, required: true }
});
const Plan = mongoose.model("Plan", PlanSchema);

const MessageLogSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  type: { type: String, default: "text" },
  status: String,
  timestamp: { type: Number, default: Date.now },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" }
});
const MessageLog = mongoose.model("MessageLog", MessageLogSchema);

const ScheduledMessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  scheduleTime: Number,
  status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
  createdAt: { type: Number, default: Date.now }
});
const ScheduledMessage = mongoose.model("ScheduledMessage", ScheduledMessageSchema);

const QueuedMessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending" },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
  createdAt: { type: Number, default: Date.now }
});
const QueuedMessage = mongoose.model("QueuedMessage", QueuedMessageSchema);

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sender: { type: String, required: true },
  message: String,
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ["pending", "processing", "completed"], default: "pending" },
  createdAt: { type: Number, default: Date.now }
});
const Campaign = mongoose.model("Campaign", CampaignSchema);

// ----------------------
// WhatsApp Memory Store
// ----------------------
const sessions = {};
const sessionStatus = {}; // { phone: { status, qr, pairingCode } }
const loggingOut = {};

// ----------------------
// Helpers
// ----------------------
const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Common Response Structure
 */
function sendResponse(res, code, message, result = null) {
  res.status(code).json({
    status: code >= 200 && code < 300,
    code: code,
    message: message,
    result: result
  });
}

function sessionFolder(phone) {
  return path.join(__dirname, "sessions", phone);
}

function sessionExists(phone) {
  return fs.existsSync(path.join(sessionFolder(phone), "creds.json"));
}

function deleteSessionFolder(phone) {
  const folder = sessionFolder(phone);
  if (fs.existsSync(folder)) {
    try {
      fs.rmSync(folder, { recursive: true, force: true });
      console.log(`🗑 Deleted session folder: ${phone}`);
    } catch (err) {
      console.log(`⚠ Error deleting folder for ${phone}:`, err.message);
    }
  }
}

async function forceLogoutWhatsApp(phone) {
  loggingOut[phone] = true;
  if (sessions[phone]) {
    try {
      sessions[phone].ev.removeAllListeners("creds.update");
      sessions[phone].ev.removeAllListeners("connection.update");
      if (sessions[phone].ws?.readyState === 1) {
        await sessions[phone].logout().catch(() => {});
      }
      if (sessions[phone].ws) sessions[phone].ws.close();
    } catch (e) {}
    delete sessions[phone];
    delete sessionStatus[phone];
  }
  deleteSessionFolder(phone);
  await delay(1000);
  delete loggingOut[phone];
}

// ----------------------
// Middleware
// ----------------------
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const tokenString = authHeader && authHeader.split(' ')[1];
  if (!tokenString) return sendResponse(res, 401, "Token required");
  try {
    const tokenData = await Token.findOne({ token: tokenString });
    if (!tokenData) return sendResponse(res, 401, "Invalid token");
    const user = await User.findOne({ number: tokenData.number });
    if (!user || !user.isActive) {
      await Token.deleteOne({ token: tokenString });
      return sendResponse(res, 403, "Access denied");
    }
    if (user.userType === "user") {
      const expiry = user.createdAt + (user.validDays * 86400000);
      if (Date.now() > expiry) {
        await Token.deleteOne({ token: tokenString });
        await forceLogoutWhatsApp(user.number);
        return sendResponse(res, 403, "Subscription expired");
      }
    }
    req.userNumber = user.number;
    req.userType = user.userType;
    next();
  } catch (err) { sendResponse(res, 500, "Auth error", err.message); }
}

const adminOnly = (req, res, next) => {
  if (req.userType !== "admin") return sendResponse(res, 403, "Admin only access");
  next();
};

// ----------------------
// WhatsApp Logic
// ----------------------
async function startSession(phone) {
  if (!sessionExists(phone)) return;
  const folder = sessionFolder(phone);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  try {
    const { state, saveCreds } = await useMultiFileAuthState(folder);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, browser: Browsers.windows("Chrome"), printQRInTerminal: false });
    sessions[phone] = sock;
    sessionStatus[phone] = { status: "connecting" };
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (!sessionStatus[phone]) sessionStatus[phone] = { status: "connecting" };
      if (qr) sessionStatus[phone].qr = qr;
      if (connection === "open") {
        sessionStatus[phone].status = "connected";
        console.log(`✅ Session connected: ${phone}`);
      }
      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          delete sessions[phone];
          delete sessionStatus[phone];
          deleteSessionFolder(phone);
        } else if (!loggingOut[phone]) {
          sessionStatus[phone].status = "disconnected";
          setTimeout(() => startSession(phone), 5000);
        }
      }
    });
  } catch (err) { console.error(`Error starting session for ${phone}:`, err.message); }
}

async function connectWhatsApp(phone) {
  if (sessions[phone] && sessions[phone].ws?.readyState === 1) {
    return { status: "connected", message: "Already connected" };
  }
  if (!fs.existsSync(sessionFolder(phone))) fs.mkdirSync(sessionFolder(phone), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder(phone));
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, browser: Browsers.windows("Chrome"), printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (!sessionStatus[phone]) sessionStatus[phone] = { status: "connecting" };
    if (qr) sessionStatus[phone].qr = qr;
    if (connection === "open") {
      sessionStatus[phone].status = "connected";
      console.log(`✅ Connected: ${phone}`);
    }
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        delete sessions[phone];
        delete sessionStatus[phone];
        deleteSessionFolder(phone);
      } else if (!loggingOut[phone]) {
        setTimeout(() => startSession(phone), 5000);
      }
    }
  });
  sessions[phone] = sock;
  sessionStatus[phone] = { status: "connecting" };
  await delay(3000);
  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(phone);
    sessionStatus[phone].pairingCode = code;
    return { status: "pairing", pairingCode: code };
  }
  return { status: "connected", message: "Already connected" };
}

// ----------------------
// Public Routes
// ----------------------
app.post("/register", async (req, res) => {
  try {
    const { name, gender, number, password, userType } = req.body;
    if (!number || !password) return sendResponse(res, 400, "Mandatory fields missing");
    const existing = await User.findOne({ number });
    if (existing) return sendResponse(res, 400, "User already exists");
    const newUser = await User.create({ number, name: name || "User", gender: gender || "N/A", password, userType: userType === "admin" ? "admin" : "user" });
    sendResponse(res, 201, "User registered successfully", newUser);
  } catch (err) { sendResponse(res, 500, "Registration failed", err.message); }
});

app.post("/login", async (req, res) => {
  try {
    const { number, password, userType } = req.body;
    const user = await User.findOne({ number, password });
    if (!user) return sendResponse(res, 401, "Invalid credentials");
    if (userType && user.userType !== userType) return sendResponse(res, 403, `This account is a ${user.userType} account.`);
    if (!user.isActive) return sendResponse(res, 403, "Account is inactive");
    const token = crypto.randomBytes(24).toString('hex');
    await Token.create({ token, number: user.number, userType: user.userType });
    sendResponse(res, 200, "Login successful", { token, user });
  } catch (err) { sendResponse(res, 500, "Login failed", err.message); }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { number, newPassword } = req.body;
    const user = await User.findOneAndUpdate({ number }, { password: newPassword }, { new: true });
    if (!user) return sendResponse(res, 404, "User not found");
    sendResponse(res, 200, "Password updated successfully");
  } catch (err) { sendResponse(res, 500, "Failed to update password", err.message); }
});

// ----------------------
// Protected Routes
// ----------------------
app.use(authenticate);

app.post("/connect", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, 400, "Phone number required");
    if (sessions[phone]) await forceLogoutWhatsApp(phone);
    await new Promise(r => setTimeout(r, 1000));
    const result = await connectWhatsApp(phone);
    sendResponse(res, 200, "Connection initiated", result);
  } catch (err) { sendResponse(res, 500, "Connection failed", err.message); }
});

app.get("/session-status", async (req, res) => {
  const phone = req.query.phone || req.userNumber;
  const status = sessionStatus[phone] || { status: "not_connected" };
  sendResponse(res, 200, "Session status fetched", { phone, ...status });
});

app.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    const sender = from || req.userNumber;
    const sock = sessions[sender];
    if (!sock || sessionStatus[sender]?.status !== "connected") return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });
    await MessageLog.create({ sender, receiver: phone, message, status: "sent" });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
    sendResponse(res, 200, "Message sent successfully", result);
  } catch (err) { sendResponse(res, 500, "Failed to send message", err.message); }
});

app.post("/broadcast", async (req, res) => {
  try {
    const { numbers, message, from } = req.body;
    const sender = from || req.userNumber;
    const sock = sessions[sender];
    if (!sock || sessionStatus[sender]?.status !== "connected") return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        await MessageLog.create({ sender, receiver: num, message, status: "sent" });
        await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
        results.push({ number: num, status: "sent" });
        await delay(1000);
      } catch (e) { results.push({ number: num, status: "failed", error: e.message }); }
    }
    sendResponse(res, 200, "Broadcast processed", { total: numbers.length, results });
  } catch (err) { sendResponse(res, 500, "Broadcast failed", err.message); }
});

app.get("/dashboard", async (req, res) => {
  try {
    const user = await User.findOne({ number: req.userNumber });
    const stat = await Stat.findOne();
    const recentLogs = await MessageLog.find({ sender: req.userNumber }).sort({ timestamp: -1 }).limit(5);
    sendResponse(res, 200, "Dashboard data fetched", { totalSent: stat ? stat.totalMessagesSent : 0, profile: user, recentLogs });
  } catch (err) { sendResponse(res, 500, "Failed to fetch dashboard", err.message); }
});

// ----------------------
// Workers
// ----------------------
setInterval(async () => {
  const now = Date.now();
  const pending = await ScheduledMessage.find({ status: "pending", scheduleTime: { $lte: now } });
  for (const msg of pending) {
    if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
      if (sessionExists(msg.sender)) await startSession(msg.sender);
      continue;
    }
    try {
      const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
      await sessions[msg.sender].sendMessage(jid, { text: msg.message });
      msg.status = "sent"; await msg.save();
      await MessageLog.create({ sender: msg.sender, receiver: msg.receiver, message: msg.message, status: "sent" });
      await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
    } catch (e) { if (now - msg.scheduleTime > 3600000) { msg.status = "failed"; await msg.save(); } }
  }
}, 30000);

setInterval(async () => {
  try {
    const msg = await QueuedMessage.findOneAndUpdate({ status: "pending" }, { status: "processing" });
    if (!msg) return;
    if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
      if (sessionExists(msg.sender)) await startSession(msg.sender);
      msg.status = "pending"; await msg.save(); return;
    }
    const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
    await sessions[msg.sender].sendMessage(jid, { text: msg.message });
    msg.status = "sent"; await msg.save();
    if (msg.campaignId) {
      await Campaign.findByIdAndUpdate(msg.campaignId, { $inc: { sentCount: 1 } });
      const camp = await Campaign.findById(msg.campaignId);
      if (camp.sentCount + camp.failedCount >= camp.totalContacts) await Campaign.findByIdAndUpdate(msg.campaignId, { status: "completed" });
    }
    await MessageLog.create({ sender: msg.sender, receiver: msg.receiver, message: msg.message, status: "sent", campaignId: msg.campaignId });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
    await delay(2000);
  } catch (e) { console.error("Queue worker error:", e.message); }
}, 10000);

// ----------------------
// Startup
// ----------------------
async function init() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("🍃 MongoDB Connected");
    const sessionsDir = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    app.listen(3000, () => {
      console.log("🚀 Server running on http://localhost:3000");
      if (fs.existsSync(sessionsDir)) {
        fs.readdirSync(sessionsDir).forEach(phone => { if (sessionExists(phone)) startSession(phone); });
      }
    });
  } catch (err) { console.error("Critical error during startup:", err.message); process.exit(1); }
}
init();
