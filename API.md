# OpenClaw Dashboard API

Base URL: `http://127.0.0.1:4318`

All responses are JSON with `{ ok: boolean, ... }` envelope.

---

## Runtime

### GET /api/runtime

Runtime data (agents, sessions, status).

**Response**
```json
{
  "ok": true,
  "data": { "...runtime snapshot..." },
  "backend": {
    "status": "online",
    "host": "127.0.0.1",
    "port": 4318,
    "refreshMs": 30000,
    "refreshing": false,
    "lastAttemptAt": "2026-03-20T10:00:00.000Z",
    "lastSuccessAt": "2026-03-20T10:00:00.000Z",
    "error": null
  }
}
```

### POST /api/runtime/refresh

Manually trigger runtime data refresh.

**Access**: Local only

**Response**
```json
{
  "ok": true,
  "data": { "...refreshed snapshot..." },
  "backend": { "..." },
  "message": "运行快照已刷新。"
}
```

---

## Auth

### GET /api/auth/status

Current auth profile summary, token health, available labels.

**Access**: Local only

**Response**
```json
{
  "ok": true,
  "data": {
    "agentId": "main",
    "currentLabel": "default",
    "labels": ["default", "backup"],
    "profile": { "exists": true, "profileKey": "...", "provider": "...", "tokenExp": "..." },
    "token": { "state": "ok", "summary": "Token 正常 · 剩余 6d", "expiresIn": "6d" },
    "bridge": { "status": "online", "port": 4318 }
  }
}
```

### POST /api/auth/refresh

Refresh auth status.

**Access**: Local only

**Response**: Same as GET /api/auth/status with `message` field.

### POST /api/auth/save

Save current auth profile with a label.

**Access**: Local only

**Body**
```json
{ "label": "my-profile" }
```

**Response**
```json
{ "ok": true, "data": { "...status..." }, "message": "已保存当前授权：my-profile" }
```

### POST /api/auth/switch

Switch to an auth profile by label.

**Access**: Local only

**Body**
```json
{ "label": "backup" }
```

**Response**
```json
{ "ok": true, "data": { "...status..." }, "message": "已切换到：backup" }
```

---

## Health

### GET /api/health

Server health check.

**Response**
```json
{
  "ok": true,
  "status": "online",
  "host": "127.0.0.1",
  "port": 4318,
  "runtimeReady": true,
  "lastSuccessAt": "2026-03-20T10:00:00.000Z"
}
```

---

## Metrics

### GET /api/metrics

System metrics (CPU, memory, uptime, Node version, platform).

**Response**
```json
{
  "ok": true,
  "data": {
    "cpu": { "model": "Apple M1", "cores": 8, "loadAvg": [1.2, 1.5, 1.8] },
    "memory": {
      "total": 17179869184,
      "free": 8589934592,
      "usedPercent": "50.0%",
      "processRss": 52428800,
      "processHeap": 20971520
    },
    "uptime": "2h 15m",
    "uptimeSeconds": 8100,
    "node": "v20.11.0",
    "platform": "darwin arm64",
    "hostname": "my-mac"
  }
}
```

---

## Logs

### GET /api/logs

Read recent lines from `~/.openclaw/logs/dashboard.log`.

**Query params**
| Param | Default | Description |
|-------|---------|-------------|
| limit | 50 | Number of lines (1–500) |

**Response**
```json
{
  "ok": true,
  "data": {
    "lines": ["[2026-03-20 10:00] started", "..."],
    "count": 2,
    "path": "/Users/apple/.openclaw/logs/dashboard.log"
  }
}
```

---

## Agents

### GET /api/agents/:id

Single agent data from runtime state.

**Response**
```json
{
  "ok": true,
  "data": {
    "id": "main",
    "name": "二弟",
    "role": "总控 / 编排",
    "status": "active",
    "sessions": 12
  }
}
```

**404** if agent not found.

### POST /api/agents/:id/task

Task dispatch stub (returns queued confirmation).

**Access**: Local only

**Body**
```json
{ "action": "research", "topic": "RAG patterns" }
```

**Response**
```json
{
  "ok": true,
  "data": {
    "agentId": "ayang",
    "task": { "action": "research", "topic": "RAG patterns" },
    "status": "queued",
    "queuedAt": "2026-03-20T10:00:00.000Z"
  },
  "message": "任务已排队给 ayang。"
}
```

---

## Sessions

### GET /api/sessions/:id

Single session data from runtime state. Matches by `id` or `key`.

**Response**
```json
{
  "ok": true,
  "data": {
    "id": "sess-9012",
    "title": "Telegram 直聊 · Dashboard 维护",
    "state": "running",
    "summary": "正在更新控制台页面与基础展示。"
  }
}
```

**404** if session not found.

---

## Config

### GET /api/config

Read `~/.openclaw/dashboard-config.json`.

**Response**
```json
{
  "ok": true,
  "data": { "theme": "dark", "refreshMs": 30000 },
  "path": "/Users/apple/.openclaw/dashboard-config.json"
}
```

### POST /api/config

Merge-update the config file.

**Access**: Local only

**Body**
```json
{ "theme": "pixel", "refreshMs": 15000 }
```

**Response**
```json
{
  "ok": true,
  "data": { "theme": "pixel", "refreshMs": 15000, "updatedAt": "2026-03-20T10:00:00.000Z" },
  "message": "配置已更新。"
}
```

---

## Access Control

Routes marked **Local only** check `req.socket.remoteAddress` and reject non-loopback clients with 403:

```json
{ "ok": false, "error": "出于安全考虑，授权操作和手动刷新只允许在这台 Mac 本机访问。局域网访问默认是只读面板。" }
```

## Error Format

All errors follow:
```json
{ "ok": false, "error": "error message string" }
```
