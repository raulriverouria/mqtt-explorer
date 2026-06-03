# MQTT Explorer Clone – macOS Implementation Plan

## Background

MQTT Explorer is a feature-rich MQTT client with a structured, hierarchical topic overview. The original is built with **Electron + React + TypeScript + Material-UI** and is cross-platform. We will replicate its full functionality as a new **Electron + React (Vite) + TypeScript** application targeting macOS, with a premium dark-mode UI.

---

## Key Features to Replicate

| Feature | Description |
|---|---|
| **Connection manager** | Save/load multiple broker profiles (host, port, TLS, auth, MQTT v3/v5) |
| **Topic tree** | Real-time hierarchical tree of all received topics, collapsible nodes |
| **Message detail panel** | Shows latest value, topic path, QoS, retained flag, timestamp |
| **Message history** | Scrollable list of all received payloads for a selected topic |
| **Value chart** | Line chart auto-rendered when payload is numeric |
| **Publish panel** | Publish to any topic with QoS, retain flag, and raw/JSON payload |
| **Topic filter** | Search/filter topics in the tree |
| **JSON syntax highlight** | Pretty-print and highlight JSON payloads |
| **Retained message clear** | Button to publish empty retained message to clear |
| **Topic subscriptions** | Custom subscription management per connection |
| **Stats bar** | Total topics, messages/sec counter |

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| App shell | **Electron 31** | Native macOS app, system tray, native menus |
| Frontend | **React 18 + Vite** | Fast HMR, TypeScript, component-based |
| Styling | **Vanilla CSS** (CSS variables) | Full control, no framework dependency |
| MQTT | **mqtt.js v5** | Browser + Node compatible, MQTT v3/v5 |
| Charts | **Chart.js + react-chartjs-2** | Lightweight, no heavy deps |
| State | **Zustand** | Simple reactive store |
| Storage | **electron-store** | Persists connection profiles |
| Fonts | **Inter** (Google Fonts) | Premium modern typography |

---

## Proposed Changes

### Project Scaffold

#### [NEW] `package.json`
Root package with Electron, Vite, React, TypeScript, mqtt, zustand, electron-store.

#### [NEW] `vite.config.ts`
Vite configuration for React renderer process.

#### [NEW] `electron/main.ts`
Electron main process: creates BrowserWindow, IPC handlers for MQTT connection/subscribe/publish, loads renderer.

#### [NEW] `electron/preload.ts`
Exposes safe IPC API to renderer (`window.mqttAPI`).

---

### Renderer – Core UI

#### [NEW] `src/index.html`
HTML entry point.

#### [NEW] `src/main.tsx`
React root, mounts `<App />`.

#### [NEW] `src/index.css`
Global design system: CSS variables (dark palette, accent colors), typography, reset.

#### [NEW] `src/App.tsx`
Root layout: `<Sidebar>` (topic tree + filter) | `<MainPanel>` (detail + history + chart + publish).

---

### Components

#### [NEW] `src/components/ConnectionDialog.tsx`
Modal form for broker connection: host, port, protocol (mqtt/mqtts/ws/wss), client ID, username/password, TLS options, MQTT version, saved profiles list.

#### [NEW] `src/components/TopicTree.tsx`
Recursive collapsible tree. Each node shows: topic segment name, latest value (truncated), message count badge. Clicking a node selects it and shows detail panel.

#### [NEW] `src/components/TopicFilter.tsx`
Search input that filters visible tree nodes in real time.

#### [NEW] `src/components/MessageDetail.tsx`
Right-side panel: topic path, QoS, retained flag, timestamp, pretty-printed JSON or raw value, copy button, clear-retained button.

#### [NEW] `src/components/MessageHistory.tsx`
Scrollable list of the last N messages for the selected topic, with timestamps.

#### [NEW] `src/components/ValueChart.tsx`
Chart.js line chart, shown when value is numeric. Auto-scales, shows last 100 data points.

#### [NEW] `src/components/PublishPanel.tsx`
Publish form: topic input, payload textarea, QoS selector, retain toggle, publish button.

#### [NEW] `src/components/StatusBar.tsx`
Bottom bar: connection status indicator, broker URL, total topics count, messages/sec.

#### [NEW] `src/components/Toolbar.tsx`
Top bar: app title/logo, connect/disconnect button, settings button.

---

### State Management

#### [NEW] `src/store/mqttStore.ts`
Zustand store holding:
- `connectionStatus`: disconnected | connecting | connected | error
- `brokerUrl`: string
- `topics`: `Map<string, TopicNode>` (tree structure)
- `selectedTopic`: string | null
- `messageHistory`: `Map<string, Message[]>` (last 200 per topic)
- Actions: `connect`, `disconnect`, `selectTopic`, `clearTopic`

#### [NEW] `src/store/profileStore.ts`
Zustand store for saved connection profiles (persisted via localStorage/electron-store).

#### [NEW] `src/types/index.ts`
Shared TypeScript types: `ConnectionProfile`, `TopicNode`, `MqttMessage`.

---

### Electron IPC Layer

#### [NEW] `electron/mqttClient.ts`
Node.js side MQTT client manager. Handles:
- `mqtt:connect` → creates mqtt.js client, forwards messages to renderer via `webContents.send`
- `mqtt:disconnect`
- `mqtt:publish`
- `mqtt:subscribe` / `mqtt:unsubscribe`
- **TLS Certificate Validation & Loading (`loadCertFile`):**
  - Reads TLS certificate/key files (`.pem`, `.crt`, `.cer`, `.key`).
  - Detects PEM format using standard headers (`-----BEGIN ...-----`).
  - Cleans up and parses multiple PEM blocks if found.
  - Falls back to binary (DER) format with a warning if no PEM blocks are detected but the file extension suggests it should be a certificate/key.

---

## UI Design Decisions

- **Dark mode** primary: `#0d1117` background, `#161b22` panels, `#21262d` cards
- **Accent**: Electric teal `#00d4aa` for connections/interactive elements
- **Topic tree**: monospace font for topic segments, subtle hover glow
- **Animations**: smooth expand/collapse for tree nodes (CSS transition), fade-in for new messages
- **macOS native feel**: vibrancy/transparency hints, native window buttons, `⌘+K` shortcut for filter focus

---

## Verification Plan

### Build Check
```bash
cd /Users/rivero/Desktop/mqtt-explorer
npm install
npm run dev
```
App window should open with connection dialog.

### Manual Verification
1. Connect to `test.mosquitto.org:1883` (public test broker)
2. Verify topic tree populates with received topics
3. Click a topic → detail panel shows value, chart renders if numeric
4. Publish a message → confirm it appears in tree/history
5. Test connection profiles: save, reload, reconnect
6. Test filter: type in filter box → tree narrows
7. **TLS Certificate Verification:**
   - Test connecting to a secure broker using TLS with certificates.
   - Load valid PEM files and verify successful parsing.
   - Load non-PEM/DER files with PEM extensions and verify console warnings (`[TLS] El fichero ... no parece estar en formato PEM. Se cargará como binario (DER).`) and correct binary buffer fallback.
