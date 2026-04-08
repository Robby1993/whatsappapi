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


app.post("/connect", async (req, res) => {

  try {

    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({
        error: "phone required"
      })
    }

    // 🔴 If already connected → logout and clear session
    if (sessions[phone]) {

      try {
        await sessions[phone].logout()
      } catch (e) {
        console.log("Logout error:", e.message)
      }

      // remove socket from memory
      delete sessions[phone]
      delete sessionStatus[phone]

      // delete session folder
      deleteSession(phone)

      console.log(`♻ Restarting login for ${phone}`)

    }

    // start new session
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

// ----------------------
// LOGOUT
// ----------------------

app.post("/logout", async (req, res) => {

  try {

    const { phone } = req.body

    const sock = sessions[phone]

    if (!sock) {
      return res.status(404).json({
        error: "session not found"
      })
    }

    await sock.logout()

    delete sessions[phone]
    delete sessionStatus[phone]

    res.json({
      success: true
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})


function deleteSession(phone) {
  const sessionPath = path.join(__dirname, "sessions", phone)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
    console.log(`🗑 Session folder deleted: ${phone}`)
  }
}

// ----------------------
// START SERVER
// ----------------------

app.listen(3000, () => {
  console.log("🚀 WhatsApp API running on http://localhost:3000")
})