const express = require("express")
const cors = require("cors")
const pino = require("pino")

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const app = express()
app.use(express.json())
app.use(cors())

let sock = null

async function startWhatsApp(phone) {

  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${phone}`)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  return new Promise((resolve, reject) => {

    sock.ev.on("connection.update", async (update) => {

      const { connection, lastDisconnect } = update

      if (connection === "open") {
        console.log("✅ WhatsApp Connected")
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error
        console.log("❌ Connection Closed:", reason)
      }

      if (!sock.authState.creds.registered) {
        try {
          const code = await sock.requestPairingCode(phone)
          console.log("Pairing Code:", code)
          resolve(code)
        } catch (err) {
          reject(err)
        }
      }

    })

  })
}

app.post("/connect", async (req, res) => {

  try {

    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({ error: "phone required" })
    }

    const code = await startWhatsApp(phone)

    res.json({
      success: true,
      pairingCode: code
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: err.message
    })
  }

})

app.post("/send-message", async (req, res) => {

  try {

    const { phone, message } = req.body

    const jid = phone + "@s.whatsapp.net"

    await sock.sendMessage(jid, { text: message })

    res.json({ success: true })

  } catch (err) {

    res.status(500).json({ error: err.message })

  }

})

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000")
})