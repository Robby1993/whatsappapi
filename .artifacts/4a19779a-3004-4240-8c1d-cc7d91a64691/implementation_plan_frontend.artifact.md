# Implementation Plan: Converting Flutter Web to Next.js (MsgPilot Frontend)

This plan outlines the migration of the "MessageHub" Flutter web application to a modern Next.js project named **MsgPilot Frontend**.

## Goal
Replace the existing Flutter web frontend with a Next.js application using Tailwind CSS, TypeScript, and Lucide React. The new frontend will interface with the refactored NestJS backend (MsgPilot).

## Proposed Changes

### 1. Project Setup
- **Framework:** Next.js (App Router).
- **Styling:** Tailwind CSS.
- **Icons:** Lucide React.
- **Language:** TypeScript.
- **API Client:** Axios.

### 2. Core Structure
- `src/app/`: App Router pages.
- `src/components/`: Reusable UI components (Sidebar, Navbar, Layout, Buttons, Modals).
- `src/lib/`: API client, utility functions, and hooks.
- `src/store/`: Auth state management.

### 3. Page Migration
- **Auth Flow:** Login, Register, Forgot Password.
- **Main Dashboard:** Statistics and recent logs.
- **WhatsApp Connections:** QR code generation, pairing code handling, and session status.
- **Campaigns:** Bulk messaging, campaign creation, and history.
- **ChatFlows:** Auto-response builder and keyword management.
- **Templates:** Management of reusable message templates.
- **Admin Panel:** User management for admin accounts.

### 4. Cleanup
- Remove the old Flutter `web/` directory.
- Place the new Next.js project in the `web/` directory (or a new `frontend/` directory).

## Verification Plan
1. **Build Verification:** Ensure `npm run build` succeeds.
2. **Auth Flow:** Verify login/register functionality against the NestJS backend.
3. **Connectivity:** Test WhatsApp QR and Pairing code flows.
4. **Messaging:** Verify sending individual and broadcast messages.
5. **Responsive Design:** Ensure the dashboard works on both desktop and tablet screens.
