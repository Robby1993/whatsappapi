const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");
const { authenticate, sendResponse } = require("../middleware/auth");

const router = express.Router();

const sessions = {};
const sessionStatus = {};
const loggingOut = {};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function sessionFolder(phone) {
  return path.join(__dirname, "../sessions", phone);
}

function sessionExists(phone) {
  return fs.existsSync(path.join(sessionFolder(phone), "creds.json"));
}

async function forceLogoutWhatsApp(phone) {
  loggingOut[phone] = true;
  if (sessions[phone]) {
    try {
      sessions[phone].ev.removeAllListeners("creds.update");
      sessions[phone].ev.removeAllListeners("connection.update");
      if (sessions[phone].ws?.readyState === 1) await sessions[phone].logout().catch(() => {});
      if (sessions[phone].ws) sessions[phone].ws.close();
    } catch (e) {}
    delete sessions[phone];
    delete sessionStatus[phone];
  }
  const folder = sessionFolder(phone);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  await delay(1000);
  delete loggingOut[phone];
}

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
        } else if (!loggingOut[phone]) {
          sessionStatus[phone].status = "disconnected";
          setTimeout(() => startSession(phone), 5000);
        }
      }
    });
  } catch (err) { console.error(`Error starting session for ${phone}:`, err.message); }
}

router.use(authenticate);

// PAIRING CODE CONNECTION
router.post("/connect-pair", async (req, res) => {
  try {
    const targetPhone = req.body.phone || req.userNumber;
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
      if (qr) sessionStatus[targetPhone].qr = qr;
      if (connection === "open") sessionStatus[targetPhone].status = "connected";
    });

    await delay(5000);

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(targetPhone);
      sessionStatus[targetPhone].pairingCode = code;
      sendResponse(res, 200, "Pairing code generated", { pairingCode: code });
    } else {
      sendResponse(res, 200, "Already connected", { status: "connected" });
    }
  } catch (err) { sendResponse(res, 500, "Pairing failed", err.message); }
});

// QR CODE CONNECTION
router.post("/connect-qr", async (req, res) => {
  try {
    const targetPhone = req.body.phone || req.userNumber;
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
      if (qr && !qrSent) {
        qrSent = true;
        sessionStatus[targetPhone].qr = qr;
        sendResponse(res, 200, "QR code generated", { qr });
      }
      if (connection === "open") sessionStatus[targetPhone].status = "connected";
    });

    setTimeout(() => { if (!qrSent) sendResponse(res, 408, "QR Timeout"); }, 45000);
  } catch (err) { sendResponse(res, 500, "QR failed", err.message); }
});

router.get("/session-status", async (req, res) => {
  const phone = req.query.phone || req.userNumber;
  sendResponse(res, 200, "Status fetched", sessionStatus[phone] || { status: "not_connected" });
});

router.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    const sender = from || req.userNumber;
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });

    await MessageLog.create({ sender, receiver: phone, message, status: "sent" });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });

    sendResponse(res, 200, "Message sent successfully", result);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.post("/broadcast", async (req, res) => {
  try {
    const { numbers, message, from } = req.body;
    const sender = from || req.userNumber;
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

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

router.post("/logout", async (req, res) => {
  try {
    await forceLogoutWhatsApp(req.body.phone || req.userNumber);
    sendResponse(res, 200, "Logged out successfully");
  } catch (err) { sendResponse(res, 500, "Logout failed", err.message); }
});

module.exports = { router, startSession, sessions, sessionStatus };
