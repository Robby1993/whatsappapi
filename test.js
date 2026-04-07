const express = require("express")
const cors = require("cors")

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

let sock // global socket

async function start() {

  const { state, saveCreds } = await useMultiFileAuthState("sessions")
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome"),
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {

    const { connection, lastDisconnect } = update

    if (connection === "connecting") {
      console.log("Connecting to WhatsApp...")
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected")
    }

    if (connection === "close") {

      const reason = lastDisconnect?.error?.output?.statusCode

      console.log("Connection closed:", reason)

      if (reason !== DisconnectReason.loggedOut) {
        console.log("Reconnecting...")
        start()
      }

    }

  })

  // request pairing code if not registered
  if (!sock.authState.creds.registered) {

    setTimeout(async () => {

      const code = await sock.requestPairingCode("918866813729")

      console.log("\n📱 Pairing Code:", code)

    }, 4000)

  }

}

start()

// --------------------
// SEND MESSAGE API
// --------------------

app.post("/send-message", async (req, res) => {

  try {

    if (!sock) {
      return res.status(500).json({
        error: "WhatsApp not connected"
      })
    }

    const { phone, message } = req.body

    if (!phone || !message) {
      return res.status(400).json({
        error: "phone and message required"
      })
    }

    const jid = phone + "@s.whatsapp.net"

    await sock.sendMessage(jid, { text: message })

    res.json({
      success: true,
      message: "Message sent"
    })

  } catch (err) {

    res.status(500).json({
      error: err.message
    })

  }

})


app.post("/send-template", async (req, res) => {

  try {

    const { phone, text } = req.body
    const jid = phone + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      text: text,
      footer: "Select option",
      buttons: [
        { buttonId: "yes", buttonText: { displayText: "Yes" }, type: 1 },
        { buttonId: "no", buttonText: { displayText: "No" }, type: 1 }
      ],
      headerType: 1
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})


app.post("/send-audio", async (req, res) => {

  try {

    const { phone, audioUrl } = req.body
    const jid = phone + "@s.whatsapp.net"

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

app.post("/send-document", async (req, res) => {

  try {

    const { phone, fileUrl, fileName } = req.body
    const jid = phone + "@s.whatsapp.net"

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

app.post("/send-video", async (req, res) => {

  try {

    const { phone, videoUrl, caption } = req.body
    const jid = phone + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      video: { url: videoUrl },
      caption: caption || ""
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})

app.post("/send-image", async (req, res) => {
  try {

    const { phone, imageUrl, caption } = req.body
    const jid = phone + "@s.whatsapp.net"

    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || ""
    })

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


/* --------------------------
LOGOUT SESSION
-------------------------- */

app.post("/logout", async (req, res) => {

  const { sessionId } = req.body

  const sock = sessions[sessionId]

  if (!sock) {
    return res.status(404).json({
      error: "Session not found"
    })
  }

  await sock.logout()

  delete sessions[sessionId]

  res.json({
    success: true
  })

})

// --------------------
// START API SERVER
// --------------------

app.listen(3000, () => {
  console.log("🚀 API running on http://localhost:3000")
})