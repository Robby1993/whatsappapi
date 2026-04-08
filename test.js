// whatsapp-api-server.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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
// In-memory storage
// ----------------------
const sessions = {};
const sessionStatus = {};
const loggingOut = {};
const templates = {};

// ----------------------
// Helpers
// ----------------------
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function sessionFolder(phone) {
  return path.join(__dirname, "sessions", phone);
}

function sessionExists(phone) {
  return fs.existsSync(path.join(sessionFolder(phone), "creds.json"));
}

function deleteSessionFolder(phone) {
  const folder = sessionFolder(phone);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    console.log(`🗑 Session folder deleted: ${phone}`);
  }
}

// ----------------------
// Start / Restore Session
// ----------------------
async function startSession(phone) {
  if (!sessionExists(phone)) return null;

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder(phone));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome"),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      sessionStatus[phone] = "connected";
      console.log(`✅ Connected: ${phone}`);
    }

    if (connection === "close") {
      sessionStatus[phone] = "disconnected";
      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log(`🚪 Logged out: ${phone}`);
        delete sessions[phone];
        delete sessionStatus[phone];
        deleteSessionFolder(phone);
      } else if (!loggingOut[phone]) {
        console.log(`🔁 Reconnecting ${phone} in 5s...`);
        setTimeout(() => startSession(phone), 5000);
      }
    }
  });

  sessions[phone] = sock;
  sessionStatus[phone] = "connecting";

  return sock;
}

async function connectWhatsApp(phone) {
  if (sessions[phone] && sessions[phone].ws?.readyState === 1) {
    return { success: true, message: "Already connected" };
  }

  if (!fs.existsSync(sessionFolder(phone))) fs.mkdirSync(sessionFolder(phone), { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder(phone));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome"),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      sessionStatus[phone] = "connected";
      console.log(`✅ Connected: ${phone}`);
    }

    if (connection === "close") {
      sessionStatus[phone] = "disconnected";
      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log(`🚪 Logged out: ${phone}`);
        delete sessions[phone];
        delete sessionStatus[phone];
        deleteSessionFolder(phone);
      } else if (!loggingOut[phone]) {
        console.log(`🔁 Reconnecting ${phone} in 5s...`);
        setTimeout(() => startSession(phone), 5000);
      }
    }
  });

  sessions[phone] = sock;
  sessionStatus[phone] = "connecting";

  await delay(3000);

  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(phone);
    console.log(`📱 Pairing Code ${phone}: ${code}`);
    return { success: true, pairingCode: code };
  }

  return { success: true, message: "Already connected" };
}

// ----------------------
// Broadcast Messages (text + media + template)
// ----------------------
async function sendBroadcast({ from, numbers, message, type = "text", mediaUrl, buttons, sections, fileName }) {
  if (!from || !numbers?.length || !message) throw new Error("from, numbers[], message required");

  let sock = sessions[from];
  if (!sock || sock.ws?.readyState !== 1) {
    if (!sessionExists(from)) throw new Error("No session found. Connect first.");
    sock = await startSession(from);

    const timeout = 15000;
    const start = Date.now();
    while (sessionStatus[from] !== "connected") {
      if (Date.now() - start > timeout) throw new Error("Connection timeout");
      await delay(500);
    }
  }

  const results = [];
  for (const num of numbers) {
    try {
      const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";

      let payload = {};
      switch (type.toLowerCase()) {
        case "text":
          payload = { text: message };
          break;
        case "image":
          if (!mediaUrl) throw new Error("mediaUrl required for image");
          payload = { image: { url: mediaUrl }, caption: message };
          break;
        case "video":
          if (!mediaUrl) throw new Error("mediaUrl required for video");
          payload = { video: { url: mediaUrl }, caption: message };
          break;
        case "audio":
          if (!mediaUrl) throw new Error("mediaUrl required for audio");
          payload = { audio: { url: mediaUrl }, mimetype: "audio/mp4", ptt: true };
          break;
        case "document":
          if (!mediaUrl) throw new Error("mediaUrl required for document");
          payload = { document: { url: mediaUrl }, fileName: fileName || "file.pdf", mimetype: "application/pdf" };
          break;
        case "buttons":
          if (!buttons?.length) throw new Error("buttons array required for type 'buttons'");
          payload = {
            text: message,
            footer: "Choose option",
            buttons: buttons.map((b, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: b }, type: 1 })),
            headerType: 1
          };
          break;
        case "list":
          if (!sections?.length) throw new Error("sections array required for type 'list'");
          payload = { text: message, footer: "Select option", buttonText: "View", sections };
          break;
        default:
          throw new Error("Invalid type");
      }

      await sock.sendMessage(jid, payload);
      results.push({ number: num, status: "sent" });
      await delay(1000); // throttle
    } catch (err) {
      results.push({ number: num, status: "failed", error: err.message });
    }
  }

  return results;
}

// ----------------------
// CONNECT WHATSAPP
// ----------------------
app.post("/connect", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    // If session exists → logout + clear (to avoid conflicts)
    if (sessions[phone]) {
      const sock = sessions[phone];
      try { await sock.logout(); } catch (e) {}
      try { sock.ws?.close(); } catch (e) {}
      delete sessions[phone];
      delete sessionStatus[phone];
      deleteSessionFolder(phone);
    }

    // Wait briefly to avoid race condition
    await new Promise(r => setTimeout(r, 1000));

    // Connect WhatsApp
    const result = await connectWhatsApp(phone);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/broadcast", async (req, res) => {
  try {
    const results = await sendBroadcast(req.body);
    res.json({ success: true, total: req.body.numbers.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Send individual messages
// ----------------------
app.post("/send-message0", async (req, res) => {
  try {
    const { phone, message, from, type = "text", mediaUrl, buttons, sections, fileName } = req.body;
    const results = await sendBroadcast({ from, numbers: [phone], message, type, mediaUrl, buttons, sections, fileName });
    res.json({ success: true, to: phone, result: results[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-message", async (req, res) => {

  try {

    const { phone, message } = req.body

    if (!phone || !message) {
      return res.status(400).json({
        error: "phone and message required"
      })
    }

    // get connected WhatsApp session
    const connectedPhone = Object.keys(sessions)[0]
    const sock = sessions[connectedPhone]

    if (!sock) {
      return res.status(400).json({
        error: "WhatsApp not connected"
      })
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net"

    const result = await sock.sendMessage(jid, {
      text: message
    })

    res.json({
      success: true,
      from: connectedPhone,
      to: phone,
      messageId: result.key.id
    })

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }

})


// ----------------------
// Logout
// ----------------------
app.post("/logout", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone required" });

    loggingOut[phone] = true;
    const sock = sessions[phone];

    if (sock) {
      try { await sock.logout(); } catch(e) {}
      try { sock.ws?.close(); } catch(e) {}
      delete sessions[phone];
      delete sessionStatus[phone];
    }

    deleteSessionFolder(phone);
    delete loggingOut[phone];
    res.json({ success: true, message: "Logged out and session cleared" });
  } catch (err) {
    delete loggingOut[req.body.phone];
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Session & Template Management
// ----------------------
app.get("/status/:phone", (req, res) => {
  const phone = req.params.phone;
  res.json({ phone, status: sessionStatus[phone] || "not_connected" });
});

app.get("/sessions", (req, res) => {
  const list = Object.keys(sessions).map(phone => ({ phone, status: sessionStatus[phone] }));
  res.json(list);
});

app.post("/template", (req, res) => {
  const { keyword, type, content, buttons, list } = req.body;
  if (!keyword || !type || !content) return res.status(400).json({ error: "keyword, type, content required" });
  templates[keyword.toLowerCase()] = { type, content, buttons, list };
  res.json({ success: true, template: templates[keyword.toLowerCase()] });
});

app.get("/templates", (req, res) => res.json(templates));

// ----------------------
// Start Server & restore sessions
// ----------------------
app.listen(3000, async () => {
  console.log("🚀 WhatsApp API running on http://localhost:3000");

  const sessionsDir = path.join(__dirname, "sessions");
  if (fs.existsSync(sessionsDir)) {
    const phones = fs.readdirSync(sessionsDir);
    for (const phone of phones) {
      if (sessionExists(phone)) {
        console.log(`🔄 Restoring session: ${phone}`);
        await startSession(phone);
      }
    }
  }
});