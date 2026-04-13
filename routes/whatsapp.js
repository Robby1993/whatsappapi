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
const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const ScheduledMessage = require("../models/ScheduledMessage");
const QueuedMessage = require("../models/QueuedMessage");
const Plan = require("../models/Plan");
const { authenticate, sendResponse } = require("../middleware/auth");

const router = express.Router();

const sessions = {};
const sessionStatus = {};
const loggingOut = {};

// Cache version
let latestBaileysVersion = null;
async function getBaileysVersion() {
  if (!latestBaileysVersion) {
    try {
      const { version } = await fetchLatestBaileysVersion();
      latestBaileysVersion = version;
    } catch (e) {
      latestBaileysVersion = [2, 3000, 1015901307];
    }
  }
  return latestBaileysVersion;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function sessionFolder(phone) {
  return path.join(__dirname, "../sessions", phone);
}

function sessionExists(phone) {
  return fs.existsSync(path.join(sessionFolder(phone), "creds.json"));
}

/**
 * Unified Socket Creation Logic
 */
async function initWhatsApp(phone) {
  const folder = sessionFolder(phone);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(folder);
  const version = await getBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"), // Stable identity
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false, // Kill history sync to prevent errors
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    generateHighQualityLinkPreview: false
  });

  sessions[phone] = sock;
  sessionStatus[phone] = { status: "connecting" };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) sessionStatus[phone].qr = qr;

    if (connection === "open") {
      sessionStatus[phone] = { status: "connected" };
      console.log(`✅ WhatsApp Connected: ${phone}`);
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Connection Closed (${phone}): ${reason}`);

      if (reason === DisconnectReason.loggedOut) {
        delete sessions[phone];
        delete sessionStatus[phone];
        if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
      } else if (!loggingOut[phone]) {
        sessionStatus[phone].status = "disconnected";
        setTimeout(() => initWhatsApp(phone), 5000);
      }
    }
  });

  return sock;
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
  return await initWhatsApp(phone);
}

router.use(authenticate);

// PAIRING CODE
router.post("/connect-pair", async (req, res) => {
  try {
    const rawPhone = req.body.phone || req.userNumber;
    const phone = rawPhone.replace(/\D/g, ""); // Digits only

    await forceLogoutWhatsApp(phone);
    const sock = await initWhatsApp(phone);

    // Wait for socket to stabilize
    await delay(3000);

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(phone);
      sessionStatus[phone].pairingCode = code;
      sendResponse(res, 200, "Pairing code generated", { pairingCode: code });
    } else {
      sendResponse(res, 200, "Already connected", { status: "connected" });
    }
  } catch (err) {
    console.error(err);
    sendResponse(res, 500, "Pairing failed", err.message);
  }
});

// QR CODE
router.post("/connect-qr", async (req, res) => {
  try {
    const phone = (req.body.phone || req.userNumber).replace(/\D/g, "");
    await forceLogoutWhatsApp(phone);
    await initWhatsApp(phone);

    let attempts = 0;
    const checkQR = setInterval(() => {
      attempts++;
      if (sessionStatus[phone]?.qr) {
        clearInterval(checkQR);
        sendResponse(res, 200, "QR generated", { qr: sessionStatus[phone].qr });
      } else if (attempts > 20) {
        clearInterval(checkQR);
        if (!res.headersSent) sendResponse(res, 408, "QR Timeout");
      }
    }, 1000);
  } catch (err) {
    sendResponse(res, 500, "QR failed", err.message);
  }
});

router.get("/session-status", async (req, res) => {
  const phone = (req.query.phone || req.userNumber).replace(/\D/g, "");
  sendResponse(res, 200, "Status fetched", sessionStatus[phone] || { status: "not_connected" });
});

router.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    const sender = (from || req.userNumber).replace(/\D/g, "");
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });

    await MessageLog.create({ sender, receiver: phone, message, status: "sent" });
    await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });

    sendResponse(res, 200, "Message sent successfully", result);
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

router.post("/logout", async (req, res) => {
  try {
    const phone = (req.body.phone || req.userNumber).replace(/\D/g, "");
    await forceLogoutWhatsApp(phone);
    sendResponse(res, 200, "Logged out successfully");
  } catch (err) {
    sendResponse(res, 500, "Logout failed", err.message);
  }
});

module.exports = { router, startSession, sessions, sessionStatus };
