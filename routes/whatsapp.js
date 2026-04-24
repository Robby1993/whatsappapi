const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const usePostgresAuthState = require("../postgresAuth");
const Session = require("../models/Session");
const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");
const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const ScheduledMessage = require("../models/ScheduledMessage");
const QueuedMessage = require("../models/QueuedMessage");
const User = require("../models/User");
const ChatFlow = require("../models/ChatFlow");
const FlowState = require("../models/FlowState");
const { authenticate, sendResponse } = require("../middleware/auth");

const router = express.Router();

const sessions = {};
const sessionStatus = {};
const loggingOut = {};

let latestBaileysVersion = null;
async function getBaileysVersion() {
  if (!latestBaileysVersion) {
    try {
      const { version } = await fetchLatestBaileysVersion();
      latestBaileysVersion = version;
    } catch (e) {
      latestBaileysVersion = [2, 3000, 1015901307];
      // latestBaileysVersion = [2, 2413, 1];
    }
  }
  return latestBaileysVersion;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function sessionFolder(phone) {
  return path.join(__dirname, "../sessions", phone);
}

async function sessionExists(phone) {
  const session = await Session.findOne({
    where: { phone, dataType: "creds", dataId: "base" }
  });
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

  // Delete from Database
  await Session.destroy({ where: { phone } });

  // Delete from Filesystem (Legacy)
  const folder = sessionFolder(phone);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });

  await delay(1000);
  delete loggingOut[phone];
}

async function handleIncomingMessage(phone, m) {
  try {
    if (!m.messages || m.type !== "notify") return;
    const msg = m.messages[0];
    if (msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const incomingText = (msg.message?.conversation ||
                         msg.message?.extendedTextMessage?.text ||
                         msg.message?.buttonsResponseMessage?.selectedButtonId ||
                         msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                         "").toLowerCase().trim();

    console.log(`📩 [${phone}] Incoming from ${remoteJid}: "${incomingText}"`);

    // --- 1. CHECK ACTIVE FLOW STATE ---
    let state = await FlowState.findOne({ where: { userNumber: phone, remoteJid } });

    if (state) {
      console.log(`🔄 [${phone}] Found active flow state for ${remoteJid}: Node ${state.currentNodeId}`);
      const flow = await ChatFlow.findByPk(state.flowId);
      if (flow && flow.nodes && flow.nodes.length > 0) {
        const currentNode = flow.nodes.find(n => String(n.id) === String(state.currentNodeId));

        if (currentNode) {
          let nextNodeId = null;
          if (currentNode.buttons) {
            const btn = currentNode.buttons.find(b =>
              b.text.toLowerCase() === incomingText ||
              String(b.next).toLowerCase() === incomingText
            );
            if (btn) nextNodeId = btn.next;
          }

          if (nextNodeId) {
            console.log(`➡️ [${phone}] Moving to next node: ${nextNodeId}`);
            const nextNode = flow.nodes.find(n => String(n.id) === String(nextNodeId));
            if (nextNode) {
              await state.update({ currentNodeId: String(nextNodeId), lastInteraction: new Date() });
              await processFlow(phone, remoteJid, flow, nextNode, state);
              return;
            }
          }
        }
      }
      console.log(`🚫 [${phone}] No matching transition, clearing flow state.`);
      await state.destroy();
    }

    // --- 2. CHECK NEW TRIGGER ---
    if (incomingText) {
      const flow = await ChatFlow.findOne({
        where: { userNumber: phone, triggerKeyword: incomingText, isActive: true }
      });

      if (flow) {
        console.log(`🚀 [${phone}] Starting flow: ${flow.triggerKeyword} (ID: ${flow.id})`);
        if (flow.nodes && flow.nodes.length > 0) {
          const firstNode = flow.nodes[0];
          state = await FlowState.create({
            userNumber: phone,
            remoteJid: remoteJid,
            flowId: flow.id,
            currentNodeId: String(firstNode.id)
          });
          await processFlow(phone, remoteJid, flow, firstNode, state);
          return;
        } else {
          // Legacy single reply
          console.log(`📜 [${phone}] Legacy response for: ${flow.triggerKeyword}`);
          // ... legacy code ...
          let response = {};
          switch (flow.responseType) {
            case "text": response = { text: flow.responseText }; break;
            case "image":
            case "video":
            case "audio":
            case "document":
              response = { [flow.responseType]: { url: flow.mediaUrl }, caption: flow.responseText };
              break;
            case "buttons":
              response = {
                text: flow.responseText,
                footer: flow.footer,
                buttons: flow.buttons.map((b, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: b }, type: 1 })),
                headerType: 1
              };
              break;
            case "list":
              response = {
                text: flow.responseText,
                title: flow.header,
                footer: flow.footer,
                buttonText: "View Options",
                sections: flow.sections
              };
              break;
          }
          await sessions[phone].sendMessage(remoteJid, response);
          return;
        }
      }
    }

    // --- 3. WEBHOOK NOTIFICATIONS ---
    const user = await User.findOne({ where: { number: phone } });
    const admin = await User.findOne({ where: { userType: "admin" } });

    const payload = {
      phone,
      sender: remoteJid,
      pushName: msg.pushName,
      message: text || "Media Message",
      timestamp: msg.messageTimestamp,
      raw: msg
    };

    if (user?.webhookUrl) axios.post(user.webhookUrl, payload).catch(() => {});
    if (admin?.webhookUrl && admin.number !== phone) axios.post(admin.webhookUrl, { ...payload, userNumber: phone }).catch(() => {});

  } catch (err) {
    console.error("Incoming Message Error:", err.message);
  }
}

async function processFlow(phone, remoteJid, flow, currentNode, state) {
  await sendNode(phone, remoteJid, currentNode);
  await delay(1000);

  if (currentNode.next) {
    const nextNode = flow.nodes.find(n => n.id === currentNode.next);
    if (nextNode && nextNode.id !== currentNode.id) {
      await state.update({ currentNodeId: nextNode.id });
      await processFlow(phone, remoteJid, flow, nextNode, state);
    }
  }
  else if (currentNode.type === "message") {
    const currentIndex = flow.nodes.findIndex(n => n.id === currentNode.id);
    if (currentIndex !== -1 && currentIndex < flow.nodes.length - 1) {
      const nextNode = flow.nodes[currentIndex + 1];
      await state.update({ currentNodeId: nextNode.id });
      if (nextNode.type !== "buttons" && nextNode.type !== "list") {
          await processFlow(phone, remoteJid, flow, nextNode, state);
      } else {
          await sendNode(phone, remoteJid, nextNode);
      }
    }
  }
}

async function sendNode(phone, remoteJid, node) {
  const sock = sessions[phone];
  if (!sock) return;

  if (node.type === "message" || !node.type) {
    await sock.sendMessage(remoteJid, { text: node.text });
  } else if (node.type === "buttons") {
    const buttons = node.buttons.map(b => ({
      buttonId: String(b.next),
      buttonText: { displayText: b.text },
      type: 1
    }));
    await sock.sendMessage(remoteJid, {
      text: node.text || "Choose an option:",
      buttons,
      headerType: 1
    });
  } else if (node.type === "list") {
    await sock.sendMessage(remoteJid, {
      text: node.text || "Select an option:",
      title: node.title,
      buttonText: node.buttonText || "View Menu",
      sections: node.sections
    });
  } else if (node.type === "image" || node.type === "video") {
     await sock.sendMessage(remoteJid, { [node.type]: { url: node.url }, caption: node.text });
  }
}

async function initWhatsApp(phone) {
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
    defaultQueryTimeoutMs: 0
  });

  sessions[phone] = sock;
  sessionStatus[phone] = { status: "connecting" };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (!sessionStatus[phone]) sessionStatus[phone] = { status: "connecting" };
    if (qr) sessionStatus[phone].qr = qr;

    if (connection === "open") {
      sessionStatus[phone].status = "connected";
      console.log(`✅ WhatsApp Connected: ${phone}`);
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        delete sessions[phone];
        delete sessionStatus[phone];
        Session.destroy({ where: { phone } }).catch(() => {});
      } else if (!loggingOut[phone]) {
        sessionStatus[phone].status = "disconnected";
        setTimeout(() => initWhatsApp(phone), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", (m) => handleIncomingMessage(phone, m));

  return sock;
}

async function startSession(phone) {
  if (!(await sessionExists(phone))) return;
  return await initWhatsApp(phone);
}

router.use(authenticate);

// --- CHATFLOW APIS ---

/**
 * @api {post} /whatsapp/chatflows Create ChatFlow
 * @body {String} triggerKeyword, {String} responseType (text|image|video|audio|document|buttons|list), {String} responseText, {String} mediaUrl, {Array} buttons, {Array} sections, {String} footer, {String} header, {Boolean} isActive
 */
router.post("/chatflows", async (req, res) => {
  try {
    const data = { ...req.body, userNumber: req.userNumber };

    // Support both 'trigger' and 'triggerKeyword'
    if (req.body.trigger && !req.body.triggerKeyword) {
      data.triggerKeyword = req.body.trigger.toLowerCase().trim();
    } else if (data.triggerKeyword) {
      data.triggerKeyword = data.triggerKeyword.toLowerCase().trim();
    }

    // --- PREVENT DUPLICATE TRIGGERS ---
    const existing = await ChatFlow.findOne({
      where: { userNumber: req.userNumber, triggerKeyword: data.triggerKeyword }
    });
    if (existing) return sendResponse(res, 400, "A ChatFlow with this trigger already exists.");

    const flow = await ChatFlow.create(data);
    sendResponse(res, 201, "ChatFlow created", flow);
  } catch (err) { sendResponse(res, 500, "Failed to create ChatFlow", err.message); }
});

/**
 * @api {get} /whatsapp/chatflows List ChatFlows
 */
router.get("/chatflows", async (req, res) => {
  try {
    const flows = await ChatFlow.findAll({ where: { userNumber: req.userNumber } });
    sendResponse(res, 200, "ChatFlows fetched", flows);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

/**
 * @api {put} /whatsapp/chatflows/:id Update ChatFlow
 */
router.put("/chatflows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const flow = await ChatFlow.findOne({ where: { id, userNumber: req.userNumber } });
    if (!flow) return sendResponse(res, 404, "ChatFlow not found");

    await flow.update(req.body);
    sendResponse(res, 200, "ChatFlow updated", flow);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

/**
 * @api {delete} /whatsapp/chatflows/:id Delete ChatFlow
 */
router.delete("/chatflows/:id", async (req, res) => {
  try {
    await ChatFlow.destroy({ where: { id: req.params.id, userNumber: req.userNumber } });
    sendResponse(res, 200, "ChatFlow deleted");
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

// --- REMAINING APIS ---

router.post("/set-webhook", async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    await User.update({ webhookUrl }, { where: { number: req.userNumber } });
    sendResponse(res, 200, "Webhook URL updated successfully");
  } catch (err) {
    sendResponse(res, 500, "Failed to update webhook", err.message);
  }
});

router.post("/connect-pair", async (req, res) => {
  try {
    const rawPhone = req.body.phone || req.userNumber;
    const phone = rawPhone.replace(/\D/g, "");

    await forceLogoutWhatsApp(phone);
    const sock = await initWhatsApp(phone);

    await delay(3000);

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

    const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
    await stat.increment('totalMessagesSent');

    sendResponse(res, 200, "Message sent successfully", result);
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

router.post("/broadcast", async (req, res) => {
  try {
    const { numbers, message, from } = req.body;
    const sender = (from || req.userNumber).replace(/\D/g, "");
    const sock = sessions[sender];

    if (!sock || sessionStatus[sender]?.status !== "connected") {
      return sendResponse(res, 400, `WhatsApp (${sender}) is disconnected.`);
    }

    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        await MessageLog.create({ sender: num, receiver: num, message, status: "sent" });

        const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');

        results.push({ number: num, status: "sent" });
        await delay(1000);
      } catch (e) { results.push({ number: num, status: "failed", error: e.message }); }
    }
    sendResponse(res, 200, "Broadcast processed", { total: numbers.length, results });
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

router.post("/create-campaign", async (req, res) => {
  try {
    const sender = req.body.from || req.userNumber;
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
