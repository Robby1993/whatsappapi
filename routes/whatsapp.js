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
  } catch (err) { console.error(err); }
}

router.use(authenticate);

router.post("/connect", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return sendResponse(res, 400, "Phone required");
  await startSession(phone);
  sendResponse(res, 200, "Connection initiated");
});

router.get("/status", async (req, res) => {
  const phone = req.query.phone || req.userNumber;
  sendResponse(res, 200, "Status fetched", sessionStatus[phone] || { status: "not_connected" });
});

router.post("/send", async (req, res) => {
  try {
    const { phone, message } = req.body;
    const sender = req.userNumber;
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, "WhatsApp disconnected");
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });

    await MessageLog.create({ sender, receiver: phone, message, status: "sent" });
    sendResponse(res, 200, "Message sent", result);
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

module.exports = { router, startSession, sessions, sessionStatus };
