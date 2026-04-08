const fs = require("fs")
const path = require("path")

const SESSION_DIR = path.join(__dirname, "sessions")

function getJid(phone){
  return phone.replace(/\D/g,'') + "@s.whatsapp.net"
}

function deleteSession(phone){
  const dir = path.join(SESSION_DIR, phone)

  if(fs.existsSync(dir)){
    fs.rmSync(dir,{recursive:true,force:true})
  }
}

module.exports = {
  getJid,
  deleteSession,
  SESSION_DIR
}