# Omnichannel Messaging API Documentation

## Authentication
All protected routes require an API Key in the header:
`x-api-key: YOUR_API_KEY`

---

### 1. WhatsApp - Send Text
```bash
curl -X POST http://localhost:3000/api/v1/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "receiver": "918866813729",
    "content": "Hello from WhatsApp Omnichannel!"
  }'
```

### 2. WhatsApp - Send Media (Image/Video)
```bash
curl -X POST http://localhost:3000/api/v1/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "receiver": "918866813729",
    "type": "image",
    "content": "https://example.com/image.jpg",
    "metadata": { "caption": "Check this out!" }
  }'
```

### 3. RCS - Send Text
```bash
curl -X POST http://localhost:3000/api/v1/whatsapp-api/rcs/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "receiver": "+918866813729",
    "content": "Hello from Google RCS!"
  }'
```

### 4. RCS - Rich Card
```bash
curl -X POST http://localhost:3000/api/v1/rcs/rich-card \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "receiver": "+918866813729",
    "metadata": {
      "richCard": {
        "standaloneCard": {
          "cardContent": {
            "title": "Special Offer!",
            "description": "Get 50% off on your first purchase.",
            "media": { "height": "MEDIUM", "contentInfo": { "fileUrl": "https://example.com/promo.png" } }
          }
        }
      }
    }
  }'
```

### 5. Broadcast (Omnichannel)
```bash
curl -X POST http://localhost:3000/api/v1/broadcast \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "channel": "whatsapp",
    "receivers": ["918866813729", "919999999999"],
    "content": "Flash Sale starting now!"
  }'
```

### 6. Get Message Status
```bash
curl -X GET http://localhost:3000/api/v1/message/status/{message_id} \
  -H "x-api-key: your_api_key"
```
