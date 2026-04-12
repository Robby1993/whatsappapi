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

function sendResponse(res, code, message, result = null) {
  const isSuccess = code >= 200 && code < 300;
  res.status(code).json({
    status: isSuccess,
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
        return sendResponse(res, 403, "Expired");
      }
    }

    req.userNumber = user.number;
    req.userType = user.userType;
    next();
  } catch (err) { sendResponse(res, 500, "Auth error", err.message); }
}

const adminOnly = (req, res, next) => {
  if (req.userType !== "admin") return sendResponse(res, 403, "Admin only");
  next();
};

// ----------------------
// Public Routes
// ----------------------

app.post("/register", async (req, res) => {
  try {
    const { name, gender, number, password, userType } = req.body;
    if (!number || !password) return sendResponse(res, 400, "Mandatory fields missing");

    const existing = await User.findOne({ number });
    if (existing) return sendResponse(res, 400, "Already exists");

    const newUser = await User.create({
      number,
      name: name || "User",
      gender: gender || "N/A",
      password,
      userType: userType === "admin" ? "admin" : "user",
      validDays: 3
    });

    sendResponse(res, 201, "Success", newUser);
  } catch (err) { sendResponse(res, 500, "Registration failed", err.message); }
});

app.post("/login", async (req, res) => {
  try {
    const { number, password, userType } = req.body;
    const user = await User.findOne({ number, password });
    if (!user) return sendResponse(res, 401, "Invalid credentials");

    if (userType && user.userType !== userType) {
      return sendResponse(res, 403, `This account is a ${user.userType} account.`);
    }

    if (!user.isActive) return sendResponse(res, 403, "Inactive");

    const token = crypto.randomBytes(24).toString('hex');
    await Token.create({ token, number: user.number, userType: user.userType });

    sendResponse(res, 200, "Logged in", { token, user });
  } catch (err) { sendResponse(res, 500, "Login failed", err.message); }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { number, newPassword } = req.body;
    if (!number || !newPassword) return sendResponse(res, 400, "Number and newPassword required");

    const user = await User.findOneAndUpdate({ number }, { password: newPassword }, { new: true });
    if (!user) return sendResponse(res, 404, "User not found");

    sendResponse(res, 200, "Password updated successfully");
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

// ----------------------
// Protected Routes
// ----------------------
app.use(authenticate);

app.get("/sessions", adminOnly, async (req, res) => {
    const list = Object.keys(sessionStatus).map(phone => ({
        phone,
        status: sessionStatus[phone].status
    }));
    sendResponse(res, 200, "Active sessions", list);
});

app.post("/clear-database", adminOnly, async (req, res) => {
  try {
    await User.deleteMany({ userType: { $ne: "admin" } });
    await Token.deleteMany({});
    await MessageLog.deleteMany({});
    await Template.deleteMany({});
    await Plan.deleteMany({});
    await ScheduledMessage.deleteMany({});
    await QueuedMessage.deleteMany({});
    await Campaign.deleteMany({});
    await Stat.deleteMany({});

    for (const phone of Object.keys(sessions)) {
        await forceLogoutWhatsApp(phone);
    }

    sendResponse(res, 200, "Database cleared (except admin users)");
  } catch (err) {
    sendResponse(res, 500, "Clear failed", err.message);
  }
});

app.get("/dashboard", async (req, res) => {
  try {
    const user = await User.findOne({ number: req.userNumber });
    const stat = await Stat.findOne();
    const recentLogs = await MessageLog.find({ sender: req.userNumber }).sort({ timestamp: -1 }).limit(5);

    sendResponse(res, 200, "Stats", {
      totalSent: stat ? stat.totalMessagesSent : 0,
      profile: user,
      recentLogs
    });
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

app.get("/users", adminOnly, async (req, res) => {
  const all = await User.find();
  sendResponse(res, 200, "Users", all);
});

app.post("/update-user", adminOnly, async (req, res) => {
  try {
    const { number, days, isActive, userType } = req.body;
    const update = {};
    if (days !== undefined) update.validDays = days;
    if (isActive !== undefined) {
        update.isActive = isActive;
        if (!isActive) await forceLogoutWhatsApp(number);
    }
    if (userType) update.userType = userType;

    const user = await User.findOneAndUpdate({ number }, update, { new: true });
    sendResponse(res, 200, "Updated", user);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

app.post("/update-profile", async (req, res) => {
  try {
    const { name, gender, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (gender) update.gender = gender;
    if (password) update.password = password;

    const user = await User.findOneAndUpdate({ number: req.userNumber }, update, { new: true });
    sendResponse(res, 200, "Profile updated", user);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

app.get("/plans", async (req, res) => {
  const all = await Plan.find();
  sendResponse(res, 200, "Plans", all);
});

app.post("/buy-subscription", async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findOne({ id: planId });
    if (!plan) return sendResponse(res, 400, "Invalid plan");

    const user = await User.findOne({ number: req.userNumber });
    const expiry = user.createdAt + (user.validDays * 86400000);

    if (Date.now() < expiry) {
      user.validDays += plan.days;
    } else {
      user.createdAt = Date.now();
      user.validDays = plan.days;
    }
    await user.save();
    sendResponse(res, 200, "Bought", user);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

app.post("/template", async (req, res) => {
  try {
    const { keyword, type, content, buttons, footer, header, sections, mediaUrl, fileName } = req.body;
    await Template.findOneAndUpdate(
      { keyword: keyword.toLowerCase() },
      { type, content, buttons, footer, header, sections, mediaUrl, fileName },
      { upsert: true, new: true }
    );
    sendResponse(res, 200, "Saved");
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

app.get("/templates", async (req, res) => {
  const all = await Template.find();
  sendResponse(res, 200, "Templates", all);
});

app.get("/message-logs", async (req, res) => {
  const logs = await MessageLog.find({ sender: req.userNumber }).sort({ timestamp: -1 });
  sendResponse(res, 200, "Logs", logs);
});

app.post("/schedule-message", async (req, res) => {
  try {
    const sender = req.body.from || req.userNumber;
    if (!sessions[sender] || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const { phone, message, scheduleTime } = req.body;
    const scheduled = await ScheduledMessage.create({
      sender: sender,
      receiver: phone,
      message,
      scheduleTime: new Date(scheduleTime).getTime()
    });
    sendResponse(res, 200, "Scheduled", scheduled);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

app.post("/enqueue-messages", async (req, res) => {
  try {
    const sender = req.body.from || req.userNumber;
    if (!sessions[sender] || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const { messages } = req.body;
    const queued = messages.map(m => ({ sender: sender, receiver: m.phone, message: m.message }));
    await QueuedMessage.insertMany(queued);
    sendResponse(res, 200, "Queued");
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

// ----------------------
// Campaign APIs
// ----------------------

app.post("/create-campaign", async (req, res) => {
  try {
    const sender = req.body.from || req.userNumber;
    if (!sessions[sender] || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const { name, message, numbers } = req.body;
    if (!name || !message || !numbers || !Array.isArray(numbers)) {
      return sendResponse(res, 400, "name, message, and numbers array required");
    }

    const campaign = await Campaign.create({
      name,
      sender: sender,
      message,
      totalContacts: numbers.length,
      status: "pending"
    });

    const queued = numbers.map(num => ({
      sender: sender,
      receiver: num,
      message: message,
      campaignId: campaign._id,
      status: "pending"
    }));

    await QueuedMessage.insertMany(queued);
    sendResponse(res, 201, "Campaign created and messages queued", campaign);
  } catch (err) { sendResponse(res, 500, "Campaign creation failed", err.message); }
});

app.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find({ sender: req.userNumber }).sort({ createdAt: -1 });
    sendResponse(res, 200, "Campaigns fetched", campaigns);
  } catch (err) { sendResponse(res, 500, "Failed to fetch campaigns", err.message); }
});

app.get("/campaign-report/:id", async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return sendResponse(res, 404, "Campaign not found");

    const logs = await MessageLog.find({ campaignId: campaign._id });
    sendResponse(res, 200, "Campaign report", { campaign, logs });
  } catch (err) { sendResponse(res, 500, "Failed to fetch report", err.message); }
});

// ----------------------
// WhatsApp logic
// ----------------------
async function startSession(phone) {
  if (!sessionExists(phone)) return;
  const folder = sessionFolder(phone);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(folder);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.windows("Chrome"),
      printQRInTerminal: false
    });

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
        } else {
            sessionStatus[phone].status = "disconnected";
            if (!loggingOut[phone]) setTimeout(() => startSession(phone), 5000);
        }
      }
    });
  } catch (err) {
    console.error(`Error starting session for ${phone}:`, err.message);
  }
}

app.post("/connect-pair", async (req, res) => {
  try {
    const { phone } = req.body;
    const targetPhone = phone || req.userNumber;
    if (!targetPhone) return sendResponse(res, 400, "Phone number required");

    await forceLogoutWhatsApp(targetPhone);

    const folder = sessionFolder(targetPhone);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(folder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ version, auth: state, browser: Browsers.windows("Chrome"), printQRInTerminal: false });

    sessions[targetPhone] = sock;
    sessionStatus[targetPhone] = { status: "connecting" };

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", ({ connection, qr }) => {
      if (!sessionStatus[targetPhone]) sessionStatus[targetPhone] = { status: "connecting" };
      if (qr) sessionStatus[targetPhone].qr = qr;
      if (connection === "open") {
        sessionStatus[targetPhone].status = "connected";
        console.log(`✅ Connected: ${targetPhone}`);
      }
    });

    await delay(5000);

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(targetPhone);
      if (!sessionStatus[targetPhone]) sessionStatus[targetPhone] = { status: "connecting" };
      sessionStatus[targetPhone].pairingCode = code;
      sendResponse(res, 200, "Pairing code generated", { pairingCode: code });
    } else {
      sendResponse(res, 200, "Already connected", { status: "connected" });
    }
  } catch (err) { sendResponse(res, 500, "Pairing failed", err.message); }
});

app.post("/connect-qr", async (req, res) => {
  try {
    const { phone } = req.body;
    const targetPhone = phone || req.userNumber;
    if (!targetPhone) return sendResponse(res, 400, "Phone number required");

    await forceLogoutWhatsApp(targetPhone);

    const folder = sessionFolder(targetPhone);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(folder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ version, auth: state, browser: Browsers.windows("Chrome"), printQRInTerminal: false });

    sessions[targetPhone] = sock;
    sessionStatus[targetPhone] = { status: "connecting" };

    sock.ev.on("creds.update", saveCreds);

    let qrSent = false;
    sock.ev.on("connection.update", (update) => {
      const { connection, qr } = update;
      if (!sessionStatus[targetPhone]) sessionStatus[targetPhone] = { status: "connecting" };
      if (qr) {
        sessionStatus[targetPhone].qr = qr;
        if (!qrSent) {
          qrSent = true;
          sendResponse(res, 200, "QR code generated", { qr });
        }
      }
      if (connection === "open") {
        sessionStatus[targetPhone].status = "connected";
        console.log(`✅ Connected via QR: ${targetPhone}`);
      }
    });

    setTimeout(() => {
      if (!qrSent) {
        if (sessionStatus[targetPhone]?.status === "connected") {
          sendResponse(res, 200, "Already connected", { status: "connected" });
        } else {
          sendResponse(res, 408, "QR Timeout");
        }
      }
    }, 45000);

  } catch (err) { sendResponse(res, 500, "QR failed", err.message); }
});

app.post("/logout", async (req, res) => {
  try {
    const { phone } = req.body;
    await forceLogoutWhatsApp(phone || req.userNumber);
    sendResponse(res, 200, "Logged out successfully");
  } catch (err) { sendResponse(res, 500, "Logout failed", err.message); }
});

app.get("/session-status", async (req, res) => {
  const phone = req.query.phone || req.userNumber;
  const status = sessionStatus[phone] || { status: "not_connected" };
  sendResponse(res, 200, "Status", { phone, ...status });
});

app.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    const sender = from || req.userNumber;
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
        return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected. Please connect first.`);
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    await sock.sendMessage(jid, { text: message });
    await MessageLog.create({ sender, receiver: phone, message, status: "sent" });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
    sendResponse(res, 200, "Sent");
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

app.post("/broadcast", async (req, res) => {
    try {
      const { numbers, message, from } = req.body;
      const sender = from || req.userNumber;
      const sock = sessions[sender];

      if (!sock || sessionStatus[sender]?.status !== "connected") {
        return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
      }

      for (const num of numbers) {
        const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        await MessageLog.create({ sender, receiver: num, message, status: "sent" });
        await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
        await delay(1000);
      }
      sendResponse(res, 200, "Broadcast sent");
    } catch (err) { sendResponse(res, 500, "Broadcast failed", err.message); }
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
  const msg = await QueuedMessage.findOneAndUpdate({ status: "pending" }, { status: "processing" });
  if (!msg) return;
  if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
    if (sessionExists(msg.sender)) await startSession(msg.sender);
    msg.status = "pending"; await msg.save(); return;
  }
  try {
    const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
    await sessions[msg.sender].sendMessage(jid, { text: msg.message });
    msg.status = "sent"; await msg.save();

    if (msg.campaignId) {
        await Campaign.findByIdAndUpdate(msg.campaignId, { $inc: { sentCount: 1 } });
        const camp = await Campaign.findById(msg.campaignId);
        if (camp.sentCount + camp.failedCount >= camp.totalContacts) {
            await Campaign.findByIdAndUpdate(msg.campaignId, { status: "completed" });
        }
    }

    await MessageLog.create({ sender: msg.sender, receiver: msg.receiver, message: msg.message, status: "sent", campaignId: msg.campaignId });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
    await delay(2000);
  } catch (e) {
      msg.status = "failed"; await msg.save();
      if (msg.campaignId) await Campaign.findByIdAndUpdate(msg.campaignId, { $inc: { failedCount: 1 } });
  }
}, 10000);

// ----------------------
// Startup
// ----------------------
async function init() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("🍃 MongoDB Connected");

    const sessionsDir = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

    app.listen(3000, () => {
      console.log("🚀 Server: http://localhost:3000");
      if (fs.existsSync(sessionsDir)) {
        fs.readdirSync(sessionsDir).forEach(phone => startSession(phone));
      }
    });
  } catch (err) { console.error("Error:", err.message); }
}
init();
