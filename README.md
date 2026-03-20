# OpenClaw Dashboard

一个面向 **个人 AI 控制台** 的本地 Dashboard。

这版重点不再是“手动刷新后看一眼”，而是：

- **后台常驻**：用 launchd/LaunchAgent 长驻运行
- **局域网可访问**：直接从同一局域网里的电脑打开
- **状态衔接统一**：页面统一使用“常驻后台 / 静态快照 / 后备数据”三层来源
- **风险收敛**：局域网访问默认只开放只读面板，敏感 auth 操作仍只允许本机执行

---

## 访问方式

### 本机访问

默认地址：

```text
http://127.0.0.1:4318
```

### 局域网访问

当 backend 监听 `0.0.0.0:4318` 后，局域网内其它设备可直接打开：

```text
http://<这台Mac的局域网IP>:4318
```

> 说明：
> - 页面和 runtime 数据可以局域网访问
> - `ocauth` 相关敏感操作默认 **只允许 dashboard 所在主机本机访问**
> - 这样可以避免把 auth 切换能力裸露给整个局域网

---

## 运行结构

现在 `scripts/auth-bridge.mjs` 不只是 auth bridge，也是一层轻量 backend：

- 定时执行 OpenClaw 状态采集
- 自动写入 `public/runtime-data.json`
- 对前端暴露 `/api/runtime`
- 继续对 Auth 面板暴露 `/api/auth/*`
- 同时直接托管 `dist/` 里的前端静态页面

所以生产使用时，不再需要单独跑 `vite dev` 才能打开页面。

---

## 开发模式

如果只是继续做前端开发：

```bash
cd /Users/apple/.openclaw/workspace/openclaw-dashboard
npm install
npm run dev
```

另开一个终端跑 backend：

```bash
npm run backend
```

开发模式下：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:4318`

---

## 生产 / 常驻使用

### 1. 先构建前端

```bash
cd /Users/apple/.openclaw/workspace/openclaw-dashboard
npm run build
```

### 2. 手动前台启动 backend（临时）

```bash
OCAUTH_BRIDGE_HOST=0.0.0.0 OCAUTH_BRIDGE_PORT=4318 npm run backend
```

启动后可直接打开：

```text
http://127.0.0.1:4318
```

或局域网：

```text
http://<局域网IP>:4318
```

---

## macOS 常驻版（LaunchAgent）

项目里附带了 launchd 配置模板：

```text
openclaw-dashboard/deploy/ai.openclaw.dashboard.plist
```

默认配置：

- Host: `0.0.0.0`
- Port: `4318`
- 自动拉取 OpenClaw 状态间隔：`30000ms`
- RunAtLoad: `true`
- KeepAlive: `true`

日志输出位置：

```text
~/.openclaw/logs/dashboard-backend.out.log
~/.openclaw/logs/dashboard-backend.err.log
```

如果已经安装到 `~/Library/LaunchAgents/ai.openclaw.dashboard.plist`，就可以用：

```bash
launchctl print gui/$(id -u)/ai.openclaw.dashboard
```

查看状态。

---

## 前端取数顺序

前端现在按这套顺序取数据：

1. 优先读当前同源 backend 的 `/api/runtime`
2. backend 不通时退回 `public/runtime-data.json`（静态快照）
3. 两者都拿不到时才退回 mock（后备数据）

并且前端默认每 **20 秒** 自动刷新一次。

刷新失败时：

- 保留上一份有效数据
- 不会一失败就整页掉回 mock
- 页面会显示“后台刷新失败，暂时保留上一份数据”

---

## 后端接口

### Runtime

- `GET /api/runtime`
- `POST /api/runtime/refresh`（仅本机）
- `GET /api/health`

### Auth

- `GET /api/auth/status`（仅本机）
- `POST /api/auth/refresh`（仅本机）
- `POST /api/auth/save`（仅本机）
- `POST /api/auth/switch`（仅本机）

---

## 当前已接入的真实信息

来自：

```bash
openclaw models status
openclaw status --deep
```

当前已接入：

- 默认模型
- auth / token 是否正常
- token 剩余有效期
- Gateway reachable / service 状态
- Telegram 总体状态
- active sessions 数量
- Sessions 表中的真实 session 列表
- 每个 session 的 key / kind / age / model / tokens
- update available 文案
- Security audit summary
- 阿羊晨间计划（来自 `memory/ayang-daily-plan.json`）

---

## 当前边界

### 已经可用

- Dashboard 主界面浏览
- 常驻 backend 自动刷新 runtime 数据
- 局域网读取面板
- Sessions 真实数据显示
- Agents 真实聚合视图
- System 页 OCAUTH 状态读取（本机）
- Save current / Switch saved label / Refresh status（本机）

### 仍然保守处理

- 最近活动时间线仍然是 mock
- Skill Library 仍是展示型分组
- OCAUTH 面板当前只优先支持 `main`
- 登录（`login <label>`）还没放进按钮，避免把 OAuth 浏览器流程直接塞进控制台

---

## 项目结构

```text
openclaw-dashboard/
├── deploy/
│   └── ai.openclaw.dashboard.plist
├── index.html
├── package.json
├── README.md
├── public/
│   └── runtime-data.json
├── scripts/
│   ├── auth-bridge.mjs
│   └── collect-openclaw-status.mjs
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── styles.css
    ├── components/
    │   ├── AuthPanel.jsx
    │   ├── Layout.jsx
    │   └── SectionHeader.jsx
    ├── data/
    │   ├── mockData.js
    │   └── runtimeData.js
    ├── hooks/
    │   ├── useAuthBridge.js
    │   └── useDashboardRuntime.js
    └── pages/
        ├── AgentsPage.jsx
        ├── OverviewPage.jsx
        ├── SessionsPage.jsx
        └── SystemPage.jsx
```
