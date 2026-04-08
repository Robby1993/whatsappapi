const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys")

const { deleteSession } = require("./utils")

const sessions = {}
const sessionStatus = {}

async function startSession(phone){

  const { state, saveCreds } =
  await useMultiFileAuthState(`sessions/${phone}`)

  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows("Chrome")
  })

  sessions[phone] = sock
  sessionStatus[phone] = "connecting"

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update",(update)=>{

    const { connection, lastDisconnect } = update

    if(connection === "open"){
      sessionStatus[phone] = "connected"
      console.log("Connected:",phone)
    }

    if(connection === "close"){

      const reason =
      lastDisconnect?.error?.output?.statusCode

      if(reason === DisconnectReason.loggedOut){

        delete sessions[phone]
        delete sessionStatus[phone]
        deleteSession(phone)

        console.log("Logged out:",phone)

      }else{

        console.log("Reconnecting:",phone)

        setTimeout(()=>{
          startSession(phone)
        },4000)

      }

    }

  })

  return sock
}

async function createPairCode(phone){

  const sock = await startSession(phone)

  await new Promise(r=>setTimeout(r,4000))

  if(!sock.authState.creds.registered){
    return await sock.requestPairingCode(phone)
  }

  return null
}

module.exports = {
  sessions,
  sessionStatus,
  startSession,
  createPairCode
}