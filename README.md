# OpenClaw Dashboard

一个给自己用的 **OpenClaw 本地控制台**。

重点不是“做一套很全的后台”，而是把几件高频事情收进一个稳定入口里：

- 看当前 OpenClaw 是否正常
- 看会话和角色现在谁在动
- 看 `main` 的授权状态
- 通过网页登录后执行控制操作
- 在局域网里直接打开控制台

---

## 当前定位

这一版已经是：

- **常驻 backend**：用 LaunchAgent 常驻运行
- **局域网可访问**：同一局域网设备可直接打开面板
- **前后端一体**：`scripts/auth-bridge.mjs` 同时提供 API 和静态页面
- **登录保护**：进入控制台前先登录，控制接口跟着登录态走

它还是一个轻量控制台，不是通用运维平台。

---

## 控制台登录

当前控制台支持网页登录账号密码。

账号密码来源：

1. 环境变量：
   - `DASHBOARD_LOGIN_USERNAME`
   - `DASHBOARD_LOGIN_PASSWORD`
2. 或本机配置文件：
   - `~/.openclaw/dashboard-config.json`
   - 结构：

```json
{
  "login": {
    "username": "dashboard",
    "password": "your-password"
  }
}
```

如果两者同时存在，环境变量优先。

---

## 访问地址

### 本机

```text
http://127.0.0.1:4318
```

### 局域网

当 backend 监听 `0.0.0.0:4318` 时，可从同一局域网访问：

```text
http://<这台 Mac 的局域网 IP>:4318
```

### 当前边界

- 不登录：只能看到登录页和健康检查
- 登录后：可以进入控制台并使用控制接口
- 不再额外区分“本机可控 / 局域网只读”

也就是说，现在的权限边界以**控制台登录账号密码**为准。

---

## 运行结构

`scripts/auth-bridge.mjs` 现在承担三件事：

1. 托管 `dist/` 前端静态页面
2. 定时刷新 runtime 数据
3. 提供控制台 API

配套的数据采集脚本是：

```text
scripts/collect-openclaw-status.mjs
```

它会调用：

- `openclaw models status`
- `openclaw status --deep`

然后把结果整理成：

```text
public/runtime-data.json
```

---

## 开发模式

```bash
cd /Users/apple/.openclaw/workspace/openclaw-dashboard
npm install
npm run dev
```

另开一个终端：

```bash
npm run backend
```

开发模式地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:4318`

---

## 生产 / 常驻使用

先 build：

```bash
cd /Users/apple/.openclaw/workspace/openclaw-dashboard
npm run build
```

临时前台启动：

```bash
OCAUTH_BRIDGE_HOST=0.0.0.0 OCAUTH_BRIDGE_PORT=4318 npm run backend
```

项目附带 LaunchAgent 模板：

```text
deploy/ai.openclaw.dashboard.plist
```

常驻日志：

```text
~/.openclaw/logs/dashboard-backend.out.log
~/.openclaw/logs/dashboard-backend.err.log
```

查看 LaunchAgent：

```bash
launchctl print gui/$(id -u)/ai.openclaw.dashboard
```

---

## 前端取数顺序

前端按这个顺序拿数据：

1. `/api/runtime`
2. `public/runtime-data.json`
3. mock fallback

默认每 **20 秒** 自动刷新一次。

如果后台刷新失败：

- 保留上一份有效数据
- 不会立刻整页掉回 mock
- 页面会提示当前显示的是旧数据

---

## 当前已接入的真实信息

来自 OpenClaw CLI 的真实信息包括：

- 默认模型
- auth / token 状态
- token 剩余有效期
- Gateway reachable / service 状态
- Telegram 总体状态
- active sessions 数量
- sessions 表里的真实会话列表
- 每个 session 的 key / kind / age / model / tokens
- update available 文案
- security audit summary
- 阿羊今日计划

### 阿羊计划来源

阿羊计划当前读取的是：

```text
/Users/apple/.openclaw/workspace-ayang/memory/ayang-daily-plan.json
```

不是 main workspace 下那份旧路径。

---

## 当前真实状态

### 已经可用

- Dashboard 主界面浏览
- 控制台网页登录
- 常驻 backend 自动刷新 runtime 数据
- Sessions 真实数据显示
- Agents 真实聚合视图
- System 页读取 `main` 的 auth 状态
- 保存授权 / 切换授权 / 手动刷新
- 登录后直接重启 gateway

### 仍然保守处理

- 最近动态时间线当前仍主要是 mock 展示
- Skill Library 仍是展示型分组
- OCAUTH 面板当前只优先支持 `main`
- OAuth 登录流程还没做成面板按钮
- 预留接口已经留出，但暂时不继续扩写

---

## 后端接口分层

### 公开

- `GET /api/health`
- `GET /api/session/status`
- `POST /api/session/login`
- `POST /api/session/logout`

### 登录后可用

- `GET /api/runtime`
- `POST /api/runtime/refresh`
- `GET /api/auth/status`
- `POST /api/auth/refresh`
- `POST /api/auth/save`
- `POST /api/auth/switch`
- `POST /api/gateway/restart`
- `GET /api/metrics`
- `GET /api/logs`
- `GET /api/agents/:id`
- `POST /api/agents/:id/task`
- `GET /api/sessions/:id`
- `GET /api/config`
- `POST /api/config`

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
    │   ├── PixelAvatar.jsx
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