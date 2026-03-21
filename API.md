# OpenClaw Dashboard API

Base URL:

```text
http://127.0.0.1:4318
```

所有响应都使用统一格式：

```json
{ "ok": true }
```

出错时：

```json
{ "ok": false, "error": "error message string" }
```

---

## 权限模型

当前版本不再区分“本机可控、局域网只读”。

### 公开接口

- `GET /api/health`
- `GET /api/session/status`
- `POST /api/session/login`
- `POST /api/session/logout`

### 登录后接口

其余 dashboard API 都要求先登录。

如果未登录，会返回：

```json
{
  "ok": false,
  "error": "请先登录控制台。",
  "loginRequired": true,
  "configured": true
}
```

如果还没配置登录账号密码，会返回：

```json
{
  "ok": false,
  "error": "控制台登录尚未配置。",
  "loginRequired": true,
  "configured": false
}
```

---

## Session

### GET /api/session/status

读取当前登录状态。

**Response**
```json
{
  "ok": true,
  "data": {
    "configured": true,
    "authenticated": false,
    "username": null
  }
}
```

### POST /api/session/login

登录控制台。

**Body**
```json
{
  "username": "dashboard",
  "password": "your-password"
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "configured": true,
    "authenticated": true,
    "username": "dashboard"
  },
  "message": "登录成功。"
}
```

### POST /api/session/logout

退出控制台登录。

---

## Runtime

### GET /api/runtime

读取当前 runtime 快照。

**Access**: Login required

**说明**：
- 这是前端主入口
- backend 刚启动时 `data` 可能暂时为 `null`
- 一旦采集完成，`data.generatedAt` 会出现

**Response**
```json
{
  "ok": true,
  "data": { "...runtime snapshot..." },
  "backend": {
    "status": "online",
    "host": "127.0.0.1",
    "port": 4318,
    "refreshMs": 15000,
    "refreshing": false,
    "lastAttemptAt": "2026-03-20T10:00:00.000Z",
    "lastSuccessAt": "2026-03-20T10:00:00.000Z",
    "error": null,
    "authControlsLocalOnly": false,
    "loginEnabled": true
  }
}
```

### POST /api/runtime/refresh

手动触发一次 runtime 刷新。

**Access**: Login required

---

## Auth

### GET /api/auth/status

读取当前 auth 概览。

**Access**: Login required

### POST /api/auth/refresh

刷新 auth 状态。

**Access**: Login required

### POST /api/auth/save

保存当前 auth 到一个 label。

**Access**: Login required

**Body**
```json
{ "label": "my-profile" }
```

### POST /api/auth/switch

切换到某个已保存 label。

**Access**: Login required

**Body**
```json
{ "label": "backup" }
```

---

## Health

### GET /api/health

基础健康检查。

**Response**
```json
{
  "ok": true,
  "status": "online",
  "host": "127.0.0.1",
  "port": 4318,
  "runtimeReady": true,
  "lastSuccessAt": "2026-03-20T10:00:00.000Z",
  "loginEnabled": true
}
```

---

## Telegram

### GET /api/telegram/accounts

读取当前可用的 Telegram 账号列表。

**Access**: Login required

### POST /api/telegram/send-file

把文件直接发到默认 Telegram 私聊，或显式发到指定 chat。

**Access**: Login required

**Body（任选一种）**

1. 传本机路径：
```json
{
  "accountId": "default",
  "filePath": "/Users/apple/Desktop/test.txt",
  "caption": "可选说明"
}
```

2. 传浏览器选中的文件：
```json
{
  "accountId": "default",
  "caption": "可选说明",
  "uploadedFile": {
    "fileName": "test.txt",
    "mimeType": "text/plain",
    "contentBase64": "...base64..."
  }
}
```

**说明**：
- 图片会走 `sendPhoto`
- 其它类型会走 `sendDocument`
- 如果没有传 `chatId`，后端会使用 `~/.openclaw/dashboard-config.json` 里的 `telegram.defaultChatId`
- 现在面板里默认使用“浏览器选择文件 + 默认私聊目标”这条链路
- `filePath` 和显式 `chatId` 仍保留，便于脚本或高级用法使用

---

## Gateway

### POST /api/gateway/restart

发起：

```bash
openclaw gateway restart
```

**Access**: Login required

**Response**
```json
{
  "ok": true,
  "data": {
    "restartedAt": "2026-03-20T10:00:00.000Z"
  },
  "message": "已发起 OpenClaw gateway 重启。"
}
```

---

## Reserved / Internal APIs

下面这些接口已经留出，并且当前都改为“登录后可用”：

### GET /api/metrics

读取本机进程与系统指标。

### GET /api/logs

读取 dashboard 日志。

Query params:

| Param | Default | Description |
|-------|---------|-------------|
| limit | 50 | Number of lines (1–500) |

### GET /api/agents/:id

读取单个 agent 的 runtime 视图。

### POST /api/agents/:id/task

任务派发 stub。

### GET /api/sessions/:id

读取单个 session 的 runtime 视图。

### GET /api/config

读取 `~/.openclaw/dashboard-config.json`。

### POST /api/config

更新 `~/.openclaw/dashboard-config.json`。

---

## 当前后端主流程

目前真正支撑前端主流程的是：

- `/api/session/status`
- `/api/session/login`
- `/api/runtime`
- `/api/health`
- `/api/auth/status`
- `/api/auth/save`
- `/api/auth/switch`
- `/api/gateway/restart`

其余接口先保留，不继续扩写。