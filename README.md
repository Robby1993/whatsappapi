Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install

npm install express cors @whiskeysockets/baileys

node test.js