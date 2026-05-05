const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");
const { Op } = require("sequelize");

const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");
const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const ScheduledMessage = require("../models/ScheduledMessage");
const QueuedMessage = require("../models/QueuedMessage");
const User = require("../models/User");
const ChatFlow = require("../models/ChatFlow");
const Session = require("../models/Session");
const usePostgresAuthState = require("../postgresAuth");
const { authenticate, sendResponse, adminOnly } = require("../middleware/auth");

const router = express.Router();

const sessions = {};
const sessionStatus = {};
const loggingOut = {};
const initializing = {};

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

async function sessionExists(phone) {
  const session = await Session.findOne({ where: { phone, dataType: "creds", dataId: "base" } });
  return !!session;
}

async function forceLogoutWhatsApp(phone) {
  loggingOut[phone] = true;
  if (sessions[phone]) {
    try {
      sessions[phone].ev.removeAllListeners("creds.update");
      sessions[phone].ev.removeAllListeners("connection.update");
      sessions[phone].ev.removeAllListeners("messages.upsert");
      if (sessions[phone].ws?.readyState === 1) await sessions[phone].logout().catch(() => {});
      if (sessions[phone].ws) sessions[phone].ws.close();
    } catch (e) {}
    delete sessions[phone];
    delete sessionStatus[phone];
  }

  await Session.destroy({ where: { phone } });

  const folder = sessionFolder(phone);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  await delay(1000);
  delete loggingOut[phone];
}

async function handleIncomingMessage(phone, m) {
  try {
    if (!m.messages || m.type !== "notify") return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;

      let msgContent = msg.message;
      if (!msgContent) continue;

      // Handle nested messages (Ephemeral, ViewOnce, etc.)
      if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
      if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;
      if (msgContent.viewOnceMessageV2) msgContent = msgContent.viewOnceMessageV2.message;
      if (msgContent.viewOnceMessageV2Extension) msgContent = msgContent.viewOnceMessageV2Extension.message;
      if (msgContent.documentWithCaptionMessage) msgContent = msgContent.documentWithCaptionMessage.message;
      if (msgContent.groupMentionedMessage) msgContent = msgContent.groupMentionedMessage.message;

      // Extract text from various message types
      const text = (
          msgContent.conversation ||
          msgContent.extendedTextMessage?.text ||
          msgContent.imageMessage?.caption ||
          msgContent.videoMessage?.caption ||
          msgContent.documentMessage?.caption ||
          msgContent.buttonsResponseMessage?.selectedButtonId ||
          msgContent.buttonsResponseMessage?.selectedDisplayText ||
          msgContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
          msgContent.listResponseMessage?.title ||
          msgContent.templateButtonReplyMessage?.selectedId ||
          msgContent.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
          msgContent.interactiveResponseMessage?.body?.text ||
          ""
      ).toLowerCase().trim();

      const sender = msg.key.remoteJid;

      if (text) {
        console.log(`📩 Message from ${sender} on ${phone}: "${text}"`);

        // Try matching by triggerKeyword (Case Insensitive)
        const flow = await ChatFlow.findOne({
          where: {
            userNumber: phone,
            triggerKeyword: { [Op.iLike]: text },
            isActive: true
          }
        });

        if (flow) {
          console.log(`🎯 Flow Triggered: ${flow.triggerKeyword}`);
          let response = {};
          switch (flow.responseType) {
            case "text":
              response = { text: flow.responseText };
              break;
            case "image":
            case "video":
            case "audio":
            case "document":
              response = {
                [flow.responseType]: { url: flow.mediaUrl },
                caption: flow.responseType === 'audio' ? undefined : flow.responseText
              };
              break;
            case "buttons":
              // For buttons, we use both old and new compatible formats if possible
              // Note: Many newer WhatsApp versions require Interactive Message for buttons
              response = {
                text: flow.responseText,
                footer: flow.footer,
                buttons: (flow.buttons || []).map((b, i) => ({
                  buttonId: b.toLowerCase().trim().replace(/\s+/g, '_'),
                  buttonText: { displayText: b },
                  type: 1
                })),
                headerType: 1
              };
              break;
            case "list":
              response = {
                text: flow.responseText,
                title: flow.header,
                footer: flow.footer,
                buttonText: "View Options",
                sections: flow.sections || []
              };
              break;
          }
          await sessions[phone].sendMessage(sender, response);
        }
      }

      // Webhook Logic
      const user = await User.findOne({ where: { number: phone } });
      const admin = await User.findOne({ where: { userType: "admin" } });

      const payload = {
        phone,
        sender,
        pushName: msg.pushName,
        message: text || "Interaction",
        type: Object.keys(msgContent)[0],
        timestamp: msg.messageTimestamp,
        raw: msg
      };

      if (user?.webhookUrl) axios.post(user.webhookUrl, payload).catch(() => {});
      if (admin?.webhookUrl && admin.number !== phone) axios.post(admin.webhookUrl, { ...payload, userNumber: phone }).catch(() => {});
    }
  } catch (err) {
    console.error("Incoming Message Error:", err.message);
  }
}

async function initWhatsApp(phone) {
  if (initializing[phone]) return initializing[phone];

  if (sessions[phone] && sessions[phone].ws?.readyState === 1) {
    if (sessionStatus[phone]?.status === "connected") return sessions[phone];
  }

  initializing[phone] = (async () => {
    try {
      // If there's an existing socket that's not fully connected or stuck, close it
      if (sessions[phone]) {
        try {
          sessions[phone].ev.removeAllListeners();
          if (sessions[phone].ws) sessions[phone].ws.close();
        } catch (e) {}
        delete sessions[phone];
      }

      console.log(`🔌 Initializing WhatsApp session: ${phone}`);
      const { state, saveCreds } = await usePostgresAuthState(phone);
      const version = await getBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        // Add default logger to catch decryption errors in our own logs if needed
        // logger: require('pino')({ level: 'error' })
      });

      sessions[phone] = sock;
      sessionStatus[phone] = { status: "connecting" };

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
        if (!sessionStatus[phone]) sessionStatus[phone] = { status: "connecting" };

        if (qr) sessionStatus[phone].qr = qr;

        if (connection === "open") {
          sessionStatus[phone] = { status: "connected", qr: null };
          console.log(`✅ WhatsApp Connected: ${phone}`);
        }

        if (connection === "close") {
          const reason = lastDisconnect?.error?.output?.statusCode;
          console.log(`❌ Connection closed for ${phone}. Reason: ${reason}`);

          if (reason === DisconnectReason.loggedOut) {
            delete sessions[phone];
            delete sessionStatus[phone];
            Session.destroy({ where: { phone } }).catch(() => {});
          } else if (!loggingOut[phone]) {
            sessionStatus[phone].status = "disconnected";
            // Exponential backoff or simple delay before reconnecting
            setTimeout(() => initWhatsApp(phone), 5000);
          }
        }
      });

      sock.ev.on("messages.upsert", (m) => handleIncomingMessage(phone, m));

      return sock;
    } catch (err) {
      console.error(`💥 Failed to init WhatsApp for ${phone}:`, err.message);
      delete sessionStatus[phone];
      throw err;
    } finally {
      delete initializing[phone];
    }
  })();

  return initializing[phone];
}

async function startSession(phone) {
  const cleanPhone = phone.toString().replace(/\D/g, "");
  if (!cleanPhone) return;
  if (!(await sessionExists(cleanPhone))) return;
  return await initWhatsApp(cleanPhone);
}

router.use(authenticate);

// --- WHATSAPP CONNECTION APIS ---

router.post("/connect-pair", async (req, res) => {
  try {
    const rawPhone = req.body.phone || req.userNumber;
    const phone = rawPhone.toString().replace(/\D/g, "");

    await forceLogoutWhatsApp(phone);
    const sock = await initWhatsApp(phone);

    await delay(5000);

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(phone);
      if (!sessionStatus[phone]) sessionStatus[phone] = { status: "connecting" };
      sessionStatus[phone].pairingCode = code;
      sendResponse(res, 200, "Pairing code generated", { pairingCode: code });
    } else {
      sendResponse(res, 200, "Already connected", { status: "connected" });
    }
  } catch (err) {
    sendResponse(res, 500, "Pairing failed", err.message);
  }
});

router.post("/connect-qr", async (req, res) => {
  try {
    const phone = (req.body.phone || req.userNumber).toString().replace(/\D/g, "");
    await forceLogoutWhatsApp(phone);
    await initWhatsApp(phone);

    let attempts = 0;
    const checkQR = setInterval(() => {
      attempts++;
      if (sessionStatus[phone]?.qr) {
        clearInterval(checkQR);
        sendResponse(res, 200, "QR generated", { qr: sessionStatus[phone].qr });
      } else if (attempts > 30) {
        clearInterval(checkQR);
        if (!res.headersSent) sendResponse(res, 408, "QR Timeout");
      }
    }, 1000);
  } catch (err) {
    sendResponse(res, 500, "QR failed", err.message);
  }
});

router.get("/session-status", async (req, res) => {
  try {
    const rawPhone = req.query.phone || req.userNumber;
    if (!rawPhone) return sendResponse(res, 400, "Phone number required");

    const phone = rawPhone.toString().replace(/\D/g, "");
    let status = sessionStatus[phone];

    if (!status && await sessionExists(phone)) {
      startSession(phone);
      return sendResponse(res, 200, "Session is restoring", { status: "restoring", phone });
    }

    if (!status) return sendResponse(res, 200, "Session not found", { status: "not_connected", phone });

    if (status.status === "connected") {
      const sock = sessions[phone];
      if (!sock || sock.ws?.readyState !== 1) status.status = "disconnected";
    }

    sendResponse(res, 200, "Status fetched", { ...status, phone });
  } catch (err) { sendResponse(res, 500, "Failed to get status", err.message); }
});

router.get("/sessions", adminOnly, async (req, res) => {
  sendResponse(res, 200, "Active sessions list", sessionStatus);
});

// --- MESSAGING & CHATFLOW APIS ---

router.post("/chatflows", async (req, res) => {
  try {
    const data = { ...req.body, userNumber: req.userNumber };
    if (data.triggerKeyword) data.triggerKeyword = data.triggerKeyword.trim();
    const flow = await ChatFlow.create(data);
    sendResponse(res, 201, "ChatFlow created", flow);
  } catch (err) { sendResponse(res, 500, "Failed to create ChatFlow", err.message); }
});

router.get("/chatflows", async (req, res) => {
  try {
    const flows = await ChatFlow.findAll({ where: { userNumber: req.userNumber } });
    sendResponse(res, 200, "ChatFlows fetched", flows);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.put("/chatflows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const flow = await ChatFlow.findOne({ where: { id, userNumber: req.userNumber } });
    if (!flow) return sendResponse(res, 404, "ChatFlow not found");

    const data = { ...req.body };
    if (data.triggerKeyword) data.triggerKeyword = data.triggerKeyword.trim();

    await flow.update(data);
    sendResponse(res, 200, "ChatFlow updated", flow);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

router.delete("/chatflows/:id", async (req, res) => {
  try {
    await ChatFlow.destroy({ where: { id: req.params.id, userNumber: req.userNumber } });
    sendResponse(res, 200, "ChatFlow deleted");
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.post("/set-webhook", async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    await User.update({ webhookUrl }, { where: { number: req.userNumber } });
    sendResponse(res, 200, "Webhook URL updated successfully");
  } catch (err) { sendResponse(res, 500, "Failed to update webhook", err.message); }
});

router.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    const sender = (from || req.userNumber).toString().replace(/\D/g, "");
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });

    await MessageLog.create({ sender: sender, receiver: phone, message, status: "sent" });
    const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
    await stat.increment('totalMessagesSent');

    sendResponse(res, 200, "Message sent successfully", result);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.post("/broadcast", async (req, res) => {
  try {
    const { numbers, message, from } = req.body;
    const sender = (from || req.userNumber).toString().replace(/\D/g, "");
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.toString().replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        await MessageLog.create({ sender: sender, receiver: num, message, status: "sent" });
        const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');
        results.push({ number: num, status: "sent" });
        await delay(1000);
      } catch (e) { results.push({ number: num, status: "failed", error: e.message }); }
    }
    sendResponse(res, 200, "Broadcast processed", { total: numbers.length, results });
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.post("/create-campaign", async (req, res) => {
  try {
    const sender = (req.body.from || req.userNumber).toString().replace(/\D/g, "");
    const { name, message, numbers } = req.body;
    if (!name || !message || !numbers) return sendResponse(res, 400, "Fields missing");
    const campaign = await Campaign.create({ name, sender, message, totalContacts: numbers.length });
    const queued = numbers.map(num => ({ sender, receiver: num, message, campaignId: campaign.id }));
    await QueuedMessage.bulkCreate(queued);
    sendResponse(res, 201, "Campaign created", campaign);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.findAll({ where: { sender: req.userNumber }, order: [['createdAt', 'DESC']] });
    sendResponse(res, 200, "Campaigns fetched", campaigns);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOne({ where: { id, sender: req.userNumber } });
    if (!campaign) return sendResponse(res, 404, "Campaign not found");

    // Delete associated queued messages
    await QueuedMessage.destroy({ where: { campaignId: id } });
    // Delete campaign itself
    await campaign.destroy();

    sendResponse(res, 200, "Campaign and queued messages deleted");
  } catch (err) { sendResponse(res, 500, "Delete failed", err.message); }
});

router.post("/logout", async (req, res) => {
  try {
    const phone = (req.body.phone || req.userNumber).toString().replace(/\D/g, "");
    await forceLogoutWhatsApp(phone);
    sendResponse(res, 200, "Logged out successfully");
  } catch (err) { sendResponse(res, 500, "Logout failed", err.message); }
});

module.exports = { router, startSession, sessions, sessionStatus };
