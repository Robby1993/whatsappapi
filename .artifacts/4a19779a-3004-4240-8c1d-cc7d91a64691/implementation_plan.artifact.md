# Implementation Plan: Monorepo Refactoring (MsgPilot)

This plan outlines the final refactoring of MsgPilot into a professional, scalable monorepo structure.

## Goal
Organize the project into `apps/` and `packages/` with centralized configurations, strict TypeScript, and feature-based architecture while preserving all existing functionality.

## User Review Required

> [!IMPORTANT]
> - **Directory Shift:** Projects are now in `apps/api`, `apps/web`, and `packages/shared`.
> - **Dependency Management:** All dependencies will be managed via the root `package.json` workspaces.
> - **Shared Package:** The `@msgpilot/shared` package will be the source of truth for types and constants used by both frontend and backend.

## Proposed Changes

### Core Infrastructure

#### [MODIFY] [root package.json](file:///E:/FlutterProject/whatsappapi/package.json)
- Update workspaces to `["apps/*", "packages/*"]`.
- Update scripts for unified development.

#### [NEW] [Turbo Config](file:///E:/FlutterProject/whatsappapi/turbo.json) (Optional but recommended for monorepos)
- Add basic Turbo configuration for caching and task orchestration.

### Backend (apps/api)

#### Refactor to Feature-Based Architecture
- Ensure all logic (Controller, Service, Module, DTOs, Models) is grouped by feature.
- Centralize database configuration and global filters/interceptors.

### Frontend (apps/web)

#### Refactor to Clean Next.js Structure
- Organize components by feature/component type.
- Centralize API client and state management.

### Shared (packages/shared)

#### Centralize Types
- Export common interfaces and enums for User, WhatsApp, and API responses.

## Verification Plan

### Automated Tests
- Run `npm run build` from the root to ensure all modules compile.
- Verify TypeScript linting passes across all workspaces.

### Manual Verification
- Start the full stack with `npm run dev`.
- Verify Auth flow, WhatsApp connection, and Campaign processing work as before.
