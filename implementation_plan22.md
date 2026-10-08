# Revised Phase 1: Production-Oriented Foundation

Based on your updated outline, we need to significantly refactor the backend into a clean modular architecture and add robust security (JWT) and reliability (local queues) layers to the Rust agent.

## User Review Required

> [!IMPORTANT]
> **Backend Refactoring:** This plan will completely restructure the backend from a single `server.js` file into a professional modular structure (`routes/`, `controllers/`, `services/`, `workers/`). The old `server.js` will be replaced.
> **Agent Local Queue:** For the agent's local queue, I propose using an append-only text file (`agent_queue.jsonl`) on the agent's local disk. When telemetry fails to send, the payload is appended as a JSON line to this file. A separate background task will continually attempt to flush this file to the backend. 

## Proposed Changes

---

### 1. Backend Architecture & Security (Node.js)

#### [MODIFY] `backend/package.json`
- Install `jsonwebtoken` for agent identity management.
- Install `express-rate-limit` for basic API protection.

#### [NEW] Modular Directory Structure
We will create a new `src` directory in the backend and split the logic logically:
- **`[NEW] src/server.js`**: The new main entry point (sets up Express, Socket.io, middleware, and imports routes).
- **`[NEW] src/routes/api.js`**: Defines the API endpoints (`/api/register`, `/api/telemetry`).
- **`[NEW] src/controllers/agentController.js`**: Handles the HTTP request/response logic for registration and ingestion.
- **`[NEW] src/services/authService.js`**: Handles JWT signing and verification.
- **`[NEW] src/services/dbService.js`**: Manages the SQLite database connection, table initialization, and queries.
- **`[NEW] src/workers/telemetryWorker.js`**: The Redis queue processor (moved from the old flat file).
- **`[NEW] src/services/rulesEngine.js`**: Upgraded rules engine containing the new Correlation Rule (File Event + CPU Spike).

#### [MODIFY] Authentication & Rate Limiting
- Add a new `POST /api/register` endpoint. The agent calls this on startup with its UUID and OS info. The backend creates the agent record and returns a signed JWT token.
- Add middleware to `POST /api/telemetry` to validate the `Authorization: Bearer <token>` header.
- Add `express-rate-limit` middleware to the API routes.

#### [DELETE] `backend/server.js` and `backend/rulesEngine.js`
- Delete the old flat files in the root `backend/` directory as they are replaced by the `src/` module structure. Update `package.json` to point to `src/server.js`.

---

### 2. Agent Reliability & Identity (Rust)

#### [MODIFY] `rust-agent/src/main.rs`
- **Identity Upgrade:** Change startup logic. The agent will first send a request to `/api/register`. It receives a JWT token and stores it in memory. All subsequent `reqwest` calls to `/api/telemetry` will include the token in the headers.
- **Telemetry Upgrade:** Update the process polling logic to also capture the `parent_process` using `sysinfo` (`process.parent()`).
- **Local Queue (Reliability Layer):** 
  - Instead of dropping failed HTTP requests or simply logging an error, write the `TelemetryPayload` as a string to a local file (`agent_queue.jsonl`).
  - Create a new background task (`tokio::spawn`) that runs every 10 seconds. It reads `agent_queue.jsonl`, attempts to send the batched events to the backend, and clears the file if successful.

---

### 3. Dashboard Updates (React)

#### [MODIFY] `src/components/WarRoomDashboard.jsx`
- We will add a new "Alerts" panel section to the UI to list out historical alerts and support basic filtering, as requested.

## Verification Plan

### Manual Verification
1. Start the modular backend.
2. Start the Rust agent. Verify it registers, receives a JWT token, and uses it for telemetry.
3. Stop the backend temporarily. Let the agent generate heartbeat and process telemetry. Verify the telemetry is saved locally to `agent_queue.jsonl`.
4. Start the backend again. Verify the agent automatically flushes the local queue file and the backend processes the backlog correctly.
5. Verify the new correlation rule works by triggering a high CPU load while simultaneously modifying a file in the honeypot.
