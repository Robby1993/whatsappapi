# Implementation Plan: Migrating to NestJS (MsgPilot)

This plan outlines the migration of the current Node.js/Express WhatsApp API to a modern, modular NestJS architecture named **MsgPilot**.

## Goal
Refactor the existing WhatsApp API into a NestJS application using TypeScript, Sequelize, and standard NestJS patterns (Dependency Injection, Guards, Interceptors, and Modules).

## User Review Required

> [!IMPORTANT]
> - **Custom Token Auth:** As requested, we will keep the `Token` table-based authentication. I will implement a `TokenAuthGuard` to maintain consistency with your current logic.
> - **Sequelize Integration:** We will use `@nestjs/sequelize` to manage your PostgreSQL database.
> - **Baileys Integration:** The `WhatsAppService` will handle the multi-session logic using `@whiskeysockets/baileys`.

## Proposed Changes

### Core Infrastructure

#### [NEW] `src/main.ts`
- Bootstraps the NestJS application.
- Configures global prefix (`/api`).
- Sets up `ValidationPipe` for automatic DTO validation.
- Integrates the global `ResponseInterceptor`.

#### [NEW] `src/database/database.module.ts`
- Configures `SequelizeModule` with PostgreSQL settings from `.env`.
- Registers all existing models.

#### [NEW] `src/common/interceptors/response.interceptor.ts`
- Implements the "Common Response Structure" `(status, code, message, result)` globally.

---

### Feature Modules

#### [NEW] `src/auth/`
- **AuthModule:** Handles authentication logic.
- **AuthService:** Validates custom tokens against the `Token` table.
- **TokenAuthGuard:** A custom NestJS Guard to protect routes.

#### [NEW] `src/users/`
- **UsersModule:** Manages `User` profiles and subscription logic.
- **UsersService:** Handles registration, login, and dashboard data.

#### [NEW] `src/whatsapp/`
- **WhatsappModule:** The heart of the application.
- **WhatsappService:** Manages Baileys sessions, connection updates, and pairing codes.
- **IncomingMessageHandler:** Service to process `messages.upsert` and trigger ChatFlows or Webhooks.
- **WhatsappController:** API endpoints for connecting, pairing, and checking session status.

#### [NEW] `src/chatflows/`
- **ChatFlowModule:** Manages automatic responses (text, media, buttons, lists).

#### [NEW] `src/campaigns/`
- **CampaignModule:** Handles broadcasts and marketing campaign creation.

#### [NEW] `src/tasks/`
- **TasksModule:** Replaces `workers/` with `@nestjs/schedule`.
- **CampaignProcessor:** Processes the message queue.
- **SchedulerProcessor:** Processes scheduled messages.

---

### Models (Transferred to TypeScript)
- `User`, `Token`, `Session`, `Campaign`, `QueuedMessage`, `ScheduledMessage`, `MessageLog`, `Stat`, `ChatFlow`, `Template`, `Plan`.

## Verification Plan

### Automated Tests
- Unit tests for `AuthService` (token validation).
- Integration tests for `WhatsappService` (session initialization).
- Validation tests for DTOs.

### Manual Verification
1. **Startup:** Verify PostgreSQL connection and successful model synchronization.
2. **Auth:** Test `/register` and `/login` to receive a token, then access protected routes.
3. **WhatsApp:** Test pairing code generation (`/connect-pair`).
4. **Messaging:** Send a test message and verify it appears in `MessageLog`.
5. **Workers:** Schedule a message and verify it sends at the correct time.
