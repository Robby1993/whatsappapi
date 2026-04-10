// whatsapp-api-server.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

// Auth and Analytics storage
const users = {};
const stats = {
  totalMessagesSent: 0,
  sessionsCount: 0,
  activeUsers: 0
};
const tokens = {};

// ----------------------
// Helpers
// ----------------------
const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Standard API Response
 */
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
    } catch (err) {
      console.error(`Error deleting session folder ${phone}:`, err.message);
    }
  }
}

// ----------------------
// Public Routes
// ----------------------

// Register API: name, gender optional; number, password mandatory
app.post("/register", (req, res) => {
  try {
    const { name, gender, number, password } = req.body;
    if (!number || !password) {
      return sendResponse(res, 400, "Number and password are mandatory");
    }
    if (users[number]) {
      return sendResponse(res, 400, "User already exists");
    }

    users[number] = {
      name: name || "User",
      gender: gender || "Not Specified",
      password: password
    };
    stats.activeUsers = Object.keys(users).length;

    sendResponse(res, 201, "User registered successfully", {
      number,
      name: users[number].name,
      gender: users[number].gender
    });
  } catch (err) {
    sendResponse(res, 500, "Registration failed", err.message);
  }
});

// Login API: Returns access token
app.post("/login", (req, res) => {
  try {
    const { number, password } = req.body;
    if (!number || !password) {
      return sendResponse(res, 400, "Number and password are required");
    }

    const user = users[number];
    if (!user || user.password !== password) {
      return sendResponse(res, 401, "Invalid number or password");
    }

    // Generate token
    const token = crypto.randomBytes(24).toString('hex');
    tokens[token] = number;

    sendResponse(res, 200, "Login successful", {
      token,
      user: { number, name: user.name, gender: user.gender }
    });
  } catch (err) {
    sendResponse(res, 500, "Login failed", err.message);
  }
});

// ----------------------
// Middleware: Authentication
// ----------------------
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || !tokens[token]) {
    return sendResponse(res, 401, "Unauthorized: Valid access token required");
  }

  req.userNumber = tokens[token];
  next();
}

// All APIs below this point require authentication
app.use(authenticate);

// ----------------------
// Protected Dashboard & Analytics API
// ----------------------

app.get("/dashboard", (req, res) => {
  try {
    const dashboardData = {
      totalMessagesSent: stats.totalMessagesSent,
      totalUsers: stats.activeUsers,
      activeSessions: Object.keys(sessions).length,
      connectedSessions: Object.values(sessionStatus).filter(s => s === "connected").length,
      sessionsList: Object.keys(sessions).map(phone => ({
        phone,
        status: sessionStatus[phone]
      }))
    };
    sendResponse(res, 200, "Dashboard analytics fetched", dashboardData);
  } catch (err) {
    sendResponse(res, 500, "Failed to fetch dashboard", err.message);
  }
});

// ----------------------
// Protected WhatsApp Session Management
// ----------------------

app.post("/connect", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, 400, "Phone number required");

    if (sessions[phone]) {
      try {
        await sessions[phone].logout();
        sessions[phone].ws?.close();
      } catch (e) {}
      delete sessions[phone];
      delete sessionStatus[phone];
      deleteSessionFolder(phone);
    }

    await delay(1000);
    const result = await connectWhatsApp(phone);
    sendResponse(res, 200, "Connection initiated", result);
  } catch (err) {
    sendResponse(res, 500, "Connection failed", err.message);
  }
});

app.post("/logout", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, 400, "Phone required");

    loggingOut[phone] = true;
    if (sessions[phone]) {
      try {
        await sessions[phone].logout();
        sessions[phone].ws?.close();
      } catch(e) {}
      delete sessions[phone];
      delete sessionStatus[phone];
    }
    deleteSessionFolder(phone);
    delete loggingOut[phone];

    sendResponse(res, 200, "Logged out and session cleared");
  } catch (err) {
    sendResponse(res, 500, "Logout failed", err.message);
  }
});

app.get("/sessions", (req, res) => {
  try {
    const list = Object.keys(sessions).map(phone => ({ phone, status: sessionStatus[phone] }));
    sendResponse(res, 200, "Sessions fetched", list);
  } catch (err) {
    sendResponse(res, 500, "Failed to fetch sessions", err.message);
  }
});

app.get("/status/:phone", (req, res) => {
  try {
    const phone = req.params.phone;
    sendResponse(res, 200, "Status fetched", { phone, status: sessionStatus[phone] || "not_connected" });
  } catch (err) {
    sendResponse(res, 500, "Failed to fetch status", err.message);
  }
});

// ----------------------
// Protected Messaging APIs
// ----------------------

app.post("/send-message", async (req, res) => {
  try {
    const { phone, message, from } = req.body;
    if (!phone || !message) return sendResponse(res, 400, "phone and message required");

    const senderPhone = from || Object.keys(sessions)[0];
    const sock = sessions[senderPhone];

    if (!sock || sessionStatus[senderPhone] !== "connected") {
      return sendResponse(res, 400, `WhatsApp session for ${senderPhone} not connected`);
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: message });

    stats.totalMessagesSent++;
    sendResponse(res, 200, "Message sent successfully", { from: senderPhone, to: phone, messageId: result.key.id });
  } catch (err) {
    sendResponse(res, 500, "Failed to send message", err.message);
  }
});

app.post("/broadcast", async (req, res) => {
  try {
    const { from, numbers, message } = req.body;
    if (!from || !numbers || !message) return sendResponse(res, 400, "from, numbers, and message required");
    if (!Array.isArray(numbers)) return sendResponse(res, 400, "numbers must be an array");

    const sock = sessions[from];
    if (!sock || sessionStatus[from] !== "connected") {
      return sendResponse(res, 400, `WhatsApp session for ${from} not connected`);
    }

    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        stats.totalMessagesSent++;
        results.push({ number: num, status: "sent" });
        await delay(1000);
      } catch (err) {
        results.push({ number: num, status: "failed", error: err.message });
      }
    }

    sendResponse(res, 200, "Broadcast processed", { total: numbers.length, results });
  } catch (err) {
    sendResponse(res, 500, "Broadcast failed", err.message);
  }
});

// ----------------------
// Protected Template APIs
// ----------------------

app.post("/template", (req, res) => {
  try {
    const { keyword, type, content, buttons, list } = req.body;
    if (!keyword || !type || !content) return sendResponse(res, 400, "keyword, type, content required");
    templates[keyword.toLowerCase()] = { type, content, buttons, list };
    sendResponse(res, 200, "Template saved", templates[keyword.toLowerCase()]);
  } catch (err) {
    sendResponse(res, 500, "Failed to save template", err.message);
  }
});

app.get("/templates", (req, res) => {
  try {
    sendResponse(res, 200, "Templates fetched", templates);
  } catch (err) {
    sendResponse(res, 500, "Failed to fetch templates", err.message);
  }
});

// ----------------------
// Core WhatsApp Logic
// ----------------------

async function startSession(phone) {
  if (!sessionExists(phone)) return null;

  try {
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
        console.log(`✅ Session restored: ${phone}`);
      }
      if (connection === "close") {
        sessionStatus[phone] = "disconnected";
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          delete sessions[phone];
          delete sessionStatus[phone];
          deleteSessionFolder(phone);
        } else if (!loggingOut[phone]) {
          console.log(`🔁 Reconnecting ${phone}...`);
          setTimeout(() => startSession(phone), 5000);
        }
      }
    });

    sessions[phone] = sock;
    sessionStatus[phone] = "connecting";
    return sock;
  } catch (err) {
    console.error(`Failed to start session ${phone}:`, err.message);
    return null;
  }
}

async function connectWhatsApp(phone) {
  if (sessions[phone] && sessionStatus[phone] === "connected") {
    return { success: true, message: "Already connected" };
  }

  if (!fs.existsSync(sessionFolder(phone))) {
    fs.mkdirSync(sessionFolder(phone), { recursive: true });
  }

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
      console.log(`✅ WhatsApp Connected: ${phone}`);
    }
    if (connection === "close") {
      sessionStatus[phone] = "disconnected";
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
  sessionStatus[phone] = "connecting";

  await delay(3000);

  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(phone);
    return { success: true, pairingCode: code };
  }

  return { success: true, message: "Already connected" };
}

// ----------------------
// Initialization
// ----------------------
app.listen(3000, async () => {
  console.log("🚀 WhatsApp API running on http://localhost:3000");

  const sessionsDir = path.join(__dirname, "sessions");
  if (fs.existsSync(sessionsDir)) {
    const phones = fs.readdirSync(sessionsDir);
    for (const phone of phones) {
      if (sessionExists(phone)) {
        await startSession(phone);
      }
    }
  }
});
