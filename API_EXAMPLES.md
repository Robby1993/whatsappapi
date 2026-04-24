# Omnichannel Messaging API Master Guide

This guide provides `curl` examples for every endpoint in the system.

## 🔑 Authentication & Profile
**Register User**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "number": "918866813729", "password": "securepassword", "userType": "user"}'
```

**Login**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"number": "918866813729", "password": "securepassword", "userType": "user"}'
```

**Update Profile (Requires Bearer Token)**
```bash
curl -X POST http://localhost:3000/auth/update-profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated"}'
```

---

## 🚀 Omnichannel V1 (API Key Auth)
*Use these for system integration. Requires `x-api-key` header.*

**WhatsApp - Send Text**
```bash
curl -X POST http://localhost:3000/api/v1/whatsapp/send \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"receiver": "918866813729", "content": "Hello from Omnichannel V1!"}'
```

**RCS - Send Rich Card**
```bash
curl -X POST http://localhost:3000/api/v1/rcs/rich-card \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "+918866813729",
    "metadata": {
      "richCard": {
        "standaloneCard": {
          "cardContent": {
            "title": "Special Offer!",
            "description": "Get 50% off.",
            "media": { "height": "MEDIUM", "contentInfo": { "fileUrl": "https://picsum.photos/500" } }
          }
        }
      }
    }
  }'
```

**Universal Broadcast**
```bash
curl -X POST http://localhost:3000/api/v1/broadcast \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "receivers": ["918866813729", "919988776655"],
    "content": "Alert: System Maintenance scheduled."
  }'
```

**Track Message Status**
```bash
curl -X GET http://localhost:3000/api/v1/message/status/MESSAGE_UUID \
  -H "x-api-key: your_api_key"
```

---

## 📱 WhatsApp Device Management
**Connect via QR Code**
```bash
curl -X POST http://localhost:3000/whatsapp/connect-qr \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Connect via Pairing Code**
```bash
curl -X POST http://localhost:3000/whatsapp/connect-pair \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"phone": "918866813729"}'
```

**Check Session Status**
```bash
curl -X GET http://localhost:3000/whatsapp/session-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🤖 Multi-Node Flows (New System)
**Create Multi-Step Flow**
```bash
curl -X POST http://localhost:3000/flows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Flow",
    "trigger": "hi",
    "nodes": [
        { "id": "1", "type": "text", "data": { "text": "Hello 👋 Welcome!" }, "next": "2" },
        { "id": "2", "type": "buttons", "data": { "text": "Choose option", "buttons": [{"id":"order","title":"Order"}, {"id":"support","title":"Support"}]} }
    ]
  }'
```

**List Flows**
```bash
curl -X GET http://localhost:3000/flows -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🤖 ChatFlow (Old System - Deprecated)
**Create Keyword Trigger**
```bash
curl -X POST http://localhost:3000/whatsapp/chatflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"triggerKeyword": "help", "responseType": "text", "responseText": "How can we assist you?", "isActive": true}'
```

---

## 📊 Campaigns & Reporting
**Create WhatsApp Campaign**
```bash
curl -X POST http://localhost:3000/whatsapp/create-campaign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Promo Jan", "message": "Check our new catalog!", "numbers": ["918866813729"]}'
```

---

## 🛡️ Admin Management
**Generate User API Key**
```bash
curl -X POST http://localhost:3000/admin/users/918866813729/generate-api-key \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**System Stats**
```bash
curl -X GET http://localhost:3000/admin/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Database Cleanup (DANGER)**
```bash
curl -X POST http://localhost:3000/admin/clear-database \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
