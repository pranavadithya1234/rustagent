# ImmunoOrg V2 - Phase 1 EDR Upgrade Plan

This plan outlines the steps to execute Phase 1 of transitioning the ImmunoOrg V2 project into a near production-grade EDR system. We will focus on:
1. Adding Process Monitoring to the Rust agent.
2. Decoupling telemetry ingestion using a Redis Message Queue in the backend.
3. Upgrading the detection rule engine from simple thresholds to a more structured, modular rule system.

## User Review Required

> [!IMPORTANT]
> **Redis Requirement:** The backend changes will use Redis for the message queue. You will need to have a Redis server running locally (e.g., via Docker `docker run -p 6379:6379 -d redis`) or installed natively. Please confirm if you are okay with adding this dependency.

## Open Questions

> [!WARNING]
> **Process Monitoring Strategy:** To detect new processes in Rust across macOS, Windows, and Linux without writing custom kernel-level drivers, the most reliable cross-platform approach for Phase 1 is to poll the system's process list (e.g., every 5 seconds) using the `sysinfo` crate and diff it against the previous list to find newly spawned processes. This is effective but might miss extremely short-lived processes (e.g., a script that runs in 1 second). Is this polling approach acceptable for Phase 1?

## Proposed Changes

---

### Backend Components

#### [MODIFY] `backend/package.json`
- Add the `redis` npm package to the project dependencies.

#### [MODIFY] `backend/server.js`
- **API Refactor:** Update the `/api/telemetry` endpoint. Instead of directly parsing rules and inserting into SQLite, it will now simply `LPUSH` the raw JSON payload into a Redis List (e.g., `telemetry_queue`) and return a `200 OK` immediately. This ensures the API never blocks.
- **Worker Loop:** Create a background async loop in the server that uses `BRPOP` to continuously pull events from the `telemetry_queue`.
- **Processing:** The worker will insert the popped events into the SQLite database and pass the data to the new rules engine.

#### [NEW] `backend/rulesEngine.js`
- Create a dedicated module to house all detection logic.
- Implement an `evaluateTelemetry(event, triggerAlertCallback)` function.
- Migrate existing rules (High CPU > 90% and File Modification).
- Add a new rule: Flag an alert if a suspicious process name (e.g., `nmap`, `nc`, `mimikatz`) is detected in the new `PROCESS_STARTED` telemetry.

---

### Rust Agent Components

#### [MODIFY] `rust-agent/src/main.rs`
- **Process Polling Task:** Spawn a new `tokio::spawn` task that wakes up every 3-5 seconds.
- **State Management:** Keep a `HashSet` of currently running PIDs.
- **Detection Logic:** On each wake-up, refresh the process list using `sysinfo::System::refresh_processes()`. Compare the new list of PIDs against the `HashSet`.
- **Telemetry Construction:** For every new PID found, extract the `name()` and `exe()` path. Send a new `PROCESS_STARTED` event to the backend. Update the `HashSet`.
- Update `TelemetryPayload` struct to accommodate process names and paths.

## Verification Plan

### Manual Verification
1. Start a local Redis instance.
2. Install new npm dependencies (`npm install redis`) and start the backend.
3. Start the Rust agent.
4. Launch a new application on your system (e.g., open a new Terminal tab, run Calculator, or run `nc`).
5. Verify in the backend terminal that:
   - The API receives the payload and pushes it to Redis.
   - The worker pops it from Redis.
   - If the process was named `nc` (Netcat), verify that the rules engine triggers a new alert and broadcasts it to the dashboard.
