const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")


const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys")

const app = express()
app.use(express.json())
app.use(cors())

// store sessions
const sessions = {}
const sessionStatus = {}

let templates = {}  // { keyword: templateObject }

// ----------------------
// CREATE SESSION
// ----------------------

async function startSession(phone) {

  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${phone}`)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome"),
    printQRInTerminal: false
  })

  sessions[phone] = sock
  sessionStatus[phone] = "connecting"

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {

    const { connection, lastDisconnect } = update

    if (connection === "connecting") {
      sessionStatus[phone] = "connecting"
      console.log(`Connecting ${phone}`)
    }

    if (connection === "open") {
      sessionStatus[phone] = "connected"
      console.log(`✅ Connected ${phone}`)
    }

    if (connection === "close") {

      sessionStatus[phone] = "disconnected"

      const reason = lastDisconnect?.error?.output?.statusCode

      console.log(`Connection closed ${phone}`)

      if (reason !== DisconnectReason.loggedOut) {
        console.log(`Reconnecting ${phone}`)
        startSession(phone)
      }

    }

  })

 /* if (!sock.authState.creds.registered) {

    const code = await sock.requestPairingCode(phone)

    console.log(`📱 Pairing Code for ${phone}:`, code)

    return code
  }*/

}


async function connectWhatsApp(phone) {

  if (sessions[phone]) {
    return { message: "Session already started" }
  }

  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${phone}`)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome"),
    printQRInTerminal: false
  })

  sessions[phone] = sock
  sessionStatus[phone] = "connecting"

  sock.ev.on("creds.update", saveCreds)


  sock.ev.on("connection.update", (update) => {

    const { connection, lastDisconnect } = update

    if (connection === "open") {
      console.log(`✅ Connected ${phone}`)
      sessionStatus[phone] = "connected"
    }

    if (connection === "close") {

      const reason = lastDisconnect?.error?.output?.statusCode

      console.log(`❌ Connection closed ${phone}`)

      // DO NOT reconnect during login
      if (reason === DisconnectReason.loggedOut) {

        console.log("User logged out")

        delete sessions[phone]
        delete sessionStatus[phone]

      } else {

        console.log("Restarting socket...")

        setTimeout(() => {
          startSession(phone)
        }, 5000)

      }

    }

  })

  // 🔹 Generate pairing code after socket initializes
  await new Promise(resolve => setTimeout(resolve, 3000))

  if (!sock.authState.creds.registered) {

    const code = await sock.requestPairingCode(phone)

    console.log(`📱 Pairing Code ${phone}:`, code)

    return {
      success: true,
      pairingCode: code
    }
  }

  return {
    success: true,
    message: "Already connected"
  }

}


// TEMPLATE MANAGEMENT
// ----------------------
app.post("/template", (req, res) => {
  const { keyword, type, content, buttons, list } = req.body
  if (!keyword || !type || !content) return res.status(400).json({ error: "keyword, type, and content required" })

  templates[keyword.toLowerCase()] = { type, content, buttons, list }
  res.json({ success: true, template: templates[keyword.toLowerCase()] })
})

app.get("/templates", (req, res) => {
  res.json(templates)
})

// ----------------------
// CHATBOT AUTOMATIC REPLY
// ----------------------
function registerBotEvents(phone) {
  const sock = sessions[phone]
  if (!sock) return

  sock.ev.on("messages.upsert", async (m) => {
    try {
      if (!m.messages) return
      const msg = m.messages[0]
      if (!msg.message || msg.key.fromMe) return

      const sender = msg.key.remoteJid
      const text = msg.message.conversation || msg.message?.extendedTextMessage?.text

      if (!text) return
      console.log(`📩 Message from ${sender}: ${text}`)

      let reply = {}

      // Example keyword-based replies
      if (text.toLowerCase().includes("hi")) {
        reply = {
          text: "Hello! Choose an option:",
          buttons: [
            { buttonId: "help", buttonText: { displayText: "Help" }, type: 1 },
            { buttonId: "info", buttonText: { displayText: "Info" }, type: 1 }
          ],
          headerType: 1
        }
      } else if (text.toLowerCase().includes("info")) {
        reply = {
          text: "Select a topic:",
          buttonText: "Topics",
          footer: "Bot Options",
          sections: [
            {
              title: "Category 1",
              rows: [
                { title: "Option 1", rowId: "opt1" },
                { title: "Option 2", rowId: "opt2" }
              ]
            }
          ]
        }
      } else {
        reply = { text: `You said: ${text}` }
      }

      await sock.sendMessage(sender, reply)
    } catch (err) {
      console.log("Bot reply error:", err.message)
    }
  })
}

// ----------------------
// CONNECT API
// ----------------------


app.post("/connect22", async (req, res) => {

  try {

    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({
        error: "phone required"
      })
    }

    // 🔴 If session exists → logout + delete
    if (sessions[phone]) {

      try {
        await sessions[phone].logout()
      } catch (e) {}

      delete sessions[phone]
      delete sessionStatus[phone]

      deleteSession(phone)

      console.log("♻️ Restarting session", phone)

    }

    const result = await connectWhatsApp(phone)

    res.json(result)

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }

})


app.post("/connectWW", async (req, res) => {

  try {

    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({
        error: "phone required"
      })
    }

    // if session exists -> logout + clear
    if (sessions[phone]) {

      console.log(`♻ Resetting existing session: ${phone}`)

      try {

        const sock = sessions[phone]

        // close websocket
        if (sock?.ws) {
          sock.ws.close()
        }

        // logout device
        await sock.logout()

      } catch (e) {
        console.log("Logout error:", e.message)
      }

      // remove from memory
      delete sessions[phone]
      delete sessionStatus[phone]

      // delete session folder
      deleteSession(phone)

    }

    // small delay to avoid race condition
    await new Promise(r => setTimeout(r, 1000))

    // start fresh login
    const result = await connectWhatsApp(phone)

    res.json(result)

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }

})

app.post("/connect", async (req, res) => {
  try {

    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({
        error: "phone required"
      })
    }

    // if session exists -> logout + clear
    if (sessions[phone]) {

      console.log(`♻ Resetting existing session: ${phone}`)

      const sock = sessions[phone]

      try {

        // logout device from WhatsApp
        await sock.logout()

      } catch (e) {
        console.log("Logout error:", e.message)
      }

      try {

        // close websocket connection
        if (sock?.ws) {
          sock.ws.close()
        }

      } catch (e) {
        console.log("WS close error:", e.message)
      }

      // remove from memory
      delete sessions[phone]
      delete sessionStatus[phone]

      // delete session folder
      deleteSession(phone)

      console.log(`🧹 Session cleared: ${phone}`)
    }

    // wait to avoid race condition
    await new Promise(r => setTimeout(r, 3000))

    // start fresh login
    const result = await connectWhatsApp(phone)

    res.json(result)

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }
})


// ----------------------
// SESSION STATUS
// ----------------------

app.get("/status/:phone", (req, res) => {

  const phone = req.params.phone

  res.json({
    phone,
    status: sessionStatus[phone] || "not_connected"
  })

})

app.post("/broadcast", async (req, res) => {
  try {
    const { from, numbers, message } = req.body;

    if (!from || !numbers || !message)
      return res.status(400).json({ error: "from, numbers, message are required" });

    const sock = sessions[from];
    if (!sock || sock.ws.readyState !== 1) {
      return res.status(400).json({ error: "WhatsApp not connected for this number" });
    }

    const results = [];

    for (const num of numbers) {
      try {
        const jid = num + "@s.whatsapp.net";
        await sock.sendMessage(jid, { text: message });
        results.push({ number: num, status: "sent" });
      } catch (err) {
        results.push({ number: num, status: "failed", error: err.message });
      }
    }

    res.json({ from, message, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// LIST ALL SESSIONS
// ----------------------

app.get("/sessions", (req, res) => {

  const list = Object.keys(sessions).map(phone => ({
    phone,
    status: sessionStatus[phone]
  }))

  res.json(list)

})

// ----------------------
// SEND TEXT
// ----------------------

app.post("/send-message1", async (req, res) => {

  try {

    const { phone, to, message } = req.body

    const sock = sessions[phone]

    if (!sock) {
      return res.status(404).json({
        error: "session not found"
      })
    }

    const jid = to + "@s.whatsapp.net"

    await sock.sendMessage(jid, { text: message })

    res.json({
      success: true
    })

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }

})

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
// SEND IMAGE
// ----------------------

app.post("/send-image", async (req, res) => {

  try {

    const { phone, to, imageUrl, caption } = req.body

    const sock = sessions[phone]

    const jid = to + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || ""
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})

// ----------------------
// SEND VIDEO
// ----------------------

app.post("/send-video", async (req, res) => {

  try {

    const { phone, to, videoUrl, caption } = req.body

    const sock = sessions[phone]

    const jid = to + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      video: { url: videoUrl },
      caption: caption || ""
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})

// ----------------------
// SEND AUDIO
// ----------------------

app.post("/send-audio", async (req, res) => {

  try {

    const { phone, to, audioUrl } = req.body

    const sock = sessions[phone]

    const jid = to + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: "audio/mp4",
      ptt: true
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})

// ----------------------
// SEND DOCUMENT
// ----------------------

app.post("/send-document", async (req, res) => {

  try {

    const { phone, to, fileUrl, fileName } = req.body

    const sock = sessions[phone]

    const jid = to + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      document: { url: fileUrl },
      fileName: fileName || "file.pdf",
      mimetype: "application/pdf"
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})


app.post("/send-template", async (req, res) => {
  try {
    const { phone, type, text, mediaUrl, caption, buttons, sections, fileName } = req.body

    if (!phone || !type) {
      return res.status(400).json({ error: "phone and type required" })
    }

    const sock = sessions[phone]

    if (!sock) {
      return res.status(400).json({ error: "WhatsApp not connected" })
    }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net"

    let messagePayload = {}

    switch (type.toLowerCase()) {
      case "text":
        if (!text) return res.status(400).json({ error: "text required for type 'text'" })
        messagePayload = { text }
        break

      case "buttons":
        if (!text || !buttons || !Array.isArray(buttons)) {
          return res.status(400).json({ error: "text and buttons array required for type 'buttons'" })
        }
        messagePayload = {
          text,
          footer: "Select an option",
          buttons: buttons.map((b, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: b }, type: 1 })),
          headerType: 1
        }
        break

      case "list":
        if (!text || !sections || !Array.isArray(sections)) {
          return res.status(400).json({ error: "text and sections array required for type 'list'" })
        }
        messagePayload = {
          text,
          footer: "Choose an option",
          buttonText: "View options",
          sections
        }
        break

      case "image":
        if (!mediaUrl) return res.status(400).json({ error: "mediaUrl required for type 'image'" })
        messagePayload = {
          image: { url: mediaUrl },
          caption: caption || ""
        }
        break

      case "video":
        if (!mediaUrl) return res.status(400).json({ error: "mediaUrl required for type 'video'" })
        messagePayload = {
          video: { url: mediaUrl },
          caption: caption || ""
        }
        break

      case "audio":
        if (!mediaUrl) return res.status(400).json({ error: "mediaUrl required for type 'audio'" })
        messagePayload = {
          audio: { url: mediaUrl },
          mimetype: "audio/mp4",
          ptt: true
        }
        break

      case "document":
        if (!mediaUrl) return res.status(400).json({ error: "mediaUrl required for type 'document'" })
        messagePayload = {
          document: { url: mediaUrl },
          fileName: fileName || "file.pdf",
          mimetype: "application/pdf"
        }
        break

      default:
        return res.status(400).json({ error: "Invalid type" })
    }

    const result = await sock.sendMessage(jid, messagePayload)

    res.json({
      success: true,
      type,
      to: phone,
      messageId: result.key.id
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})



app.post("/logout2", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "phone required" });
    }

    const sock = sessions[phone];

    if (!sock) {
      // If session folder exists, delete it anyway
      deleteSession(phone);
      return res.status(404).json({ error: "session not found, folder cleared" });
    }

    // Ensure socket is connected before calling logout
    if (!sock.user || sock.ws.readyState !== 1) {
      console.log("🔄 Socket not active, reconnecting to logout...");

      // Recreate socket
      const { state, saveCreds } = await useMultiFileAuthState(`sessions/${phone}`);
      const { version } = await fetchLatestBaileysVersion();

      const tempSock = makeWASocket({
        version,
        auth: state,
        browser: Browsers.windows("Chrome"),
        printQRInTerminal: false
      });

      await new Promise((resolve) => {
        tempSock.ev.on("connection.update", (update) => {
          if (update.connection === "open") {
            console.log("✅ Reconnected to WhatsApp for logout");
            resolve();
          }
        });
      });

      // Replace sock with tempSock for logout
      sessions[phone] = tempSock;
    }

    try {
      // Logout from WhatsApp (unlink device)
      await sessions[phone].logout();
      console.log(`✅ WhatsApp unlinked: ${phone}`);
    } catch (e) {
      console.log("⚠ Logout failed:", e.message);
    }

    // Close websocket
    if (sessions[phone]?.ws) {
      sessions[phone].ws.close();
    }

    // Remove memory references
    delete sessions[phone];
    delete sessionStatus[phone];

    await new Promise(r => setTimeout(r, 500)); // wait 0.5 sec

    // Delete session folder
    deleteSession(phone);

    res.json({
      success: true,
      message: "WhatsApp unlinked and session cleared"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/logout", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    let sock = sessions[phone];

    // Step 1: If socket exists but inactive, reconnect temporarily
    if (!sock || sock.ws.readyState !== 1) {
      console.log("🔄 Socket inactive, creating temp socket for logout...");

      const { state, saveCreds } = await useMultiFileAuthState(`sessions/${phone}`);
      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        auth: state,
        browser: Browsers.windows("Chrome"),
        printQRInTerminal: false
      });

      await new Promise((resolve) => {
        sock.ev.on("connection.update", (update) => {
          if (update.connection === "open") {
            console.log("✅ Temp socket connected for logout");
            resolve();
          }
        });
      });
    }

    // Step 2: Logout from WhatsApp server
    try {
      await sock.logout();
      console.log(`✅ WhatsApp unlinked: ${phone}`);
    } catch (e) {
      console.log("⚠ Logout failed (maybe session already expired):", e.message);
    }

    // Step 3: Close the WebSocket
    if (sock.ws) {
      sock.ws.close();
      console.log("🔌 Socket closed");
    }

    // Step 4: Clean memory
    delete sessions[phone];
    delete sessionStatus[phone];

    // Step 5: Wait a short time to ensure cleanup
    await new Promise(r => setTimeout(r, 500));

    // Step 6: Delete session folder
    deleteSession(phone);

    res.json({
      success: true,
      message: "WhatsApp unlinked, socket closed, memory cleared, session folder deleted"
    });

  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/force-logout", async (req,res)=>{

 const { phone } = req.body

 delete sessions[phone]
 delete sessionStatus[phone]

 deleteSession(phone)

 res.json({success:true})

})

// Helper to delete session folder

function deleteSession(phone) {
  const sessionPath = path.join(__dirname, "sessions", phone);

  if (fs.existsSync(sessionPath)) {
    try {
      // Use recursive force delete
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑 Session folder deleted: ${phone}`);
    } catch (err) {
      console.log(`⚠ Failed to delete session folder ${phone}:`, err.message);
    }
  }
}


// ----------------------
// START SERVER
// ----------------------

app.listen(3000, () => {
  console.log("🚀 WhatsApp API running on http://localhost:3000")
})