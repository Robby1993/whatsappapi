# MsgPilot - WhatsApp Automation Monorepo

A modular WhatsApp API and automation platform built with NestJS and Next.js.

## Project Structure

- **`api/`**: NestJS backend handling WhatsApp socket connections (Baileys), PostgreSQL database (Sequelize), and background tasks.
- **`web/`**: Next.js frontend with a modern dashboard built with Tailwind CSS and Lucide icons.
- **`shared/`**: Shared TypeScript interfaces, types, and constants used by both frontend and backend.

## Prerequisites

- Node.js (v18+)
- PostgreSQL
- WhatsApp account for pairing

## Getting Started

### 1. Install Dependencies
From the root directory:
```bash
npm install
```

### 2. Configure Environment
- **API:** Create `api/.env` with your `DATABASE_URL` and `PORT`.
- **Web:** Create `web/.env.local` if you need to override the `NEXT_PUBLIC_API_URL`.

### 3. Run Development Servers

**Start Backend (API):**
```bash
npm run api:dev
```

**Start Frontend (Web):**
```bash
npm run web:dev
```

## Features

- **Multi-Device Support:** Connect multiple WhatsApp accounts via QR or Pairing Code.
- **ChatFlows:** Keyword-based automated responses.
- **Campaigns:** Bulk messaging with real-time progress tracking.
- **Templates:** Manage reusable message content.
- **Admin Dashboard:** Monitor system health and manage users.

## License
MIT
