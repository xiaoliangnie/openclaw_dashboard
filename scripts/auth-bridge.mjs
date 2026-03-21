import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ProxyAgent } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const runtimeDataPath = path.join(projectRoot, 'public', 'runtime-data.json');
const collectorScriptPath = path.join(projectRoot, 'scripts', 'collect-openclaw-status.mjs');

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.OCAUTH_BRIDGE_PORT || 4318);
const HOST = process.env.OCAUTH_BRIDGE_HOST || '127.0.0.1';
const RUNTIME_REFRESH_MS = Number(process.env.DASHBOARD_RUNTIME_REFRESH_MS || 15000);
const RUNTIME_STALE_MS = Number(process.env.DASHBOARD_RUNTIME_STALE_MS || Math.max(RUNTIME_REFRESH_MS + 5000, 20000));
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/Users/apple/.npm-global/bin/openclaw';
const agentId = 'main';
const openclawDir = path.join(os.homedir(), '.openclaw');
const backupDir = path.join(os.homedir(), '.openclaw-auth-profiles');
const authScript = '/Users/apple/.openclaw/workspace/skills/openclaw-auth-switch/scripts/switch-openclaw-auth.sh';
const authFile = path.join(openclawDir, 'agents', agentId, 'agent', 'auth-profiles.json');
const currentLabelPath = path.join(backupDir, `.current_${agentId}`);
const dashboardConfigPath = path.join(openclawDir, 'dashboard-config.json');

const runtimeState = {
  data: null,
  error: null,
  lastSuccessAt: null,
  lastAttemptAt: null,
  refreshing: false,
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function stripAnsi(value = '') {
  return value.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

function safeLabel(label) {
  return /^[a-zA-Z0-9._-]{1,40}$/.test(label || '');
}

function readJsonMaybe(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readRuntimeSnapshot() {
  return readJsonMaybe(runtimeDataPath);
}

function readDashboardConfig() {
  return readJsonMaybe(dashboardConfigPath) || {};
}

function readOpenClawConfig() {
  return readJsonMaybe(path.join(openclawDir, 'openclaw.json')) || {};
}

function listTelegramAccounts() {
  const accounts = readOpenClawConfig()?.channels?.telegram?.accounts || {};
  return Object.entries(accounts)
    .filter(([, value]) => value && value.enabled !== false && value.botToken)
    .map(([id, value]) => ({
      id,
      name: value.name || id,
    }));
}

function getTelegramBotToken(accountId = 'default') {
  const accounts = readOpenClawConfig()?.channels?.telegram?.accounts || {};
  const account = accounts?.[accountId];
  return account?.enabled === false ? null : account?.botToken || null;
}

function getTelegramProxyUrl() {
  const config = readOpenClawConfig();
  return config?.channels?.telegram?.proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || null;
}

let telegramProxyAgent = null;
function getTelegramFetchOptions() {
  const proxyUrl = getTelegramProxyUrl();
  if (!proxyUrl) return {};
  if (!telegramProxyAgent) {
    telegramProxyAgent = new ProxyAgent(proxyUrl);
  }
  return { dispatcher: telegramProxyAgent };
}

function resolveTelegramSendPath(inputPath) {
  const raw = String(inputPath || '').trim();
  if (!raw) return null;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(projectRoot, raw);
}

async function sendTelegramFile({ accountId = 'default', chatId, filePath, caption = '', uploadedFile = null }) {
  const token = getTelegramBotToken(accountId);
  if (!token) {
    throw new Error(`Telegram 账号 ${accountId} 不存在，或没有可用 bot token。`);
  }

  let body;
  let fileName;
  let mimeType;

  if (uploadedFile) {
    const contentBase64 = String(uploadedFile.contentBase64 || '');
    if (!contentBase64) {
      throw new Error('上传文件内容为空。');
    }
    body = Buffer.from(contentBase64, 'base64');
    fileName = String(uploadedFile.fileName || 'upload.bin').trim() || 'upload.bin';
    mimeType = String(uploadedFile.mimeType || mimeTypeFor(fileName));
  } else {
    const resolvedPath = resolveTelegramSendPath(filePath);
    if (!resolvedPath || !existsSync(resolvedPath)) {
      throw new Error('文件路径不存在，无法发送。');
    }
    body = await readFile(resolvedPath);
    fileName = path.basename(resolvedPath);
    mimeType = mimeTypeFor(resolvedPath);
  }

  const isImage = /^image\//i.test(mimeType);
  const method = isImage ? 'sendPhoto' : 'sendDocument';
  const field = isImage ? 'photo' : 'document';

  const form = new FormData();
  form.set('chat_id', String(chatId));
  if (caption) {
    form.set('caption', caption);
  }
  form.set(field, new Blob([body], { type: mimeType }), fileName);

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: form,
    ...getTelegramFetchOptions(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API 请求失败（${response.status}）`);
  }

  return {
    accountId,
    method,
    fileName,
    mimeType,
    chatId: String(chatId),
    messageId: payload?.result?.message_id || null,
    sentAt: new Date().toISOString(),
  };
}

function getDashboardLoginConfig() {
  const config = readDashboardConfig();
  const login = config?.login && typeof config.login === 'object' ? config.login : {};
  const username = process.env.DASHBOARD_LOGIN_USERNAME || login.username || null;
  const password = process.env.DASHBOARD_LOGIN_PASSWORD || login.password || null;

  if (!username || !password) {
    return null;
  }

  return {
    username: String(username),
    password: String(password),
  };
}

function getDashboardTelegramConfig() {
  const config = readDashboardConfig();
  const telegram = config?.telegram && typeof config.telegram === 'object' ? config.telegram : {};
  const defaultChatId = process.env.DASHBOARD_DEFAULT_TELEGRAM_CHAT_ID || telegram.defaultChatId || null;

  return {
    defaultChatId: defaultChatId ? String(defaultChatId).trim() : null,
  };
}

const SESSION_COOKIE_NAME = 'openclaw_dashboard_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

function passwordMatches(expected, received) {
  if (!expected || !received) return false;
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(received));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};

  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    result[rawKey] = decodeURIComponent(rawValue.join('=') || '');
  }

  return result;
}

function getSessionSecret() {
  const config = readDashboardConfig();
  const fromEnv = process.env.DASHBOARD_SESSION_SECRET;
  const fromConfig = config?.sessionSecret;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return String(fromEnv);
  if (typeof fromConfig === 'string' && fromConfig.trim()) return String(fromConfig);

  const login = getDashboardLoginConfig();
  if (!login) return null;
  return `openclaw-dashboard:${login.username}:${login.password}`;
}

function signSessionPayload(payload) {
  const secret = getSessionSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSession(username) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ username, expiresAt }), 'utf8').toString('base64url');
  const signature = signSessionPayload(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!token) return null;

  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;

  const expectedSignature = signSessionPayload(payload);
  if (!expectedSignature) return null;
  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.username || !parsed?.expiresAt) return null;
    if (Number(parsed.expiresAt) <= Date.now()) return null;
    return {
      token,
      username: String(parsed.username),
      expiresAt: Number(parsed.expiresAt),
    };
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function requireSession(req, res) {
  const login = getDashboardLoginConfig();
  if (!login) {
    json(res, 503, {
      ok: false,
      error: '控制台登录尚未配置。',
      loginRequired: true,
      configured: false,
    });
    return null;
  }

  const session = readSession(req);
  if (session) {
    return session;
  }

  json(res, 401, {
    ok: false,
    error: '请先登录控制台。',
    loginRequired: true,
    configured: true,
  });
  return null;
}

function readCurrentLabel() {
  if (!existsSync(currentLabelPath)) {
    return '未知';
  }
  return readFileSync(currentLabelPath, 'utf8').trim() || '未知';
}

function normalizeRemoteAddress(req) {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function isLocalRequest(req) {
  const address = normalizeRemoteAddress(req);
  return address === '127.0.0.1' || address === '::1' || address === 'localhost';
}

function parseAuthProfileSummary() {
  const raw = readJsonMaybe(authFile);
  const profiles = raw?.profiles && typeof raw.profiles === 'object' ? Object.entries(raw.profiles) : [];
  const [profileKey, profile] = profiles[0] || [];
  const accessToken = profile?.access || '';
  const accountId = profile?.accountId || null;
  const email = profile?.email || null;
  let tokenExp = null;
  let planType = null;

  const parts = accessToken.split('.');
  if (parts.length >= 2) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      tokenExp = payload?.exp ? new Date(payload.exp * 1000).toISOString() : null;
      planType = payload?.['https://api.openai.com/auth']?.chatgpt_plan_type || null;
    } catch {
      // ignore invalid token payload
    }
  }

  return {
    exists: Boolean(raw),
    profileKey: profileKey || null,
    provider: profile?.provider || null,
    type: profile?.type || null,
    accountId,
    email,
    tokenExp,
    planType,
    profileCount: profiles.length,
    filePath: authFile,
  };
}

function formatTimeRemaining(isoValue) {
  if (!isoValue) return null;
  const diff = new Date(isoValue).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return '已过期';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d`;

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;

  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes}m`;
}

function parseTokenHealth(rawOutput, profileSummary) {
  const clean = stripAnsi(rawOutput || '');
  const line = clean
    .split('\n')
    .map((item) => item.trim())
    .find((item) => /^-\s+openai-codex:/i.test(item) || /openai-codex:.*\b(ok|expired|error)\b/i.test(item));

  if (!line) {
    if (profileSummary.exists && profileSummary.tokenExp) {
      const expiresIn = formatTimeRemaining(profileSummary.tokenExp) || profileSummary.tokenExp;
      return {
        state: expiresIn === '已过期' ? 'expired' : 'ok',
        summary: expiresIn === '已过期' ? 'Token 已过期' : `Token 正常 · 剩余 ${expiresIn}`,
        expiresIn,
        raw: clean.trim() || null,
      };
    }

    return {
      state: profileSummary.exists ? 'unknown' : 'missing',
      summary: profileSummary.exists ? '授权文件存在，但没有读到 token 状态。' : '还没有读到授权文件。',
      expiresIn: null,
      raw: clean.trim() || null,
    };
  }

  const stateMatch = line.match(/\b(ok|expired|error)\b/i);
  const expiresMatch = line.match(/expires in\s+(.+)$/i);
  const state = stateMatch?.[1]?.toLowerCase() || 'unknown';
  const expiresIn = expiresMatch?.[1]?.trim() || null;

  return {
    state,
    summary: state === 'ok' ? `Token 正常${expiresIn ? ` · 剩余 ${expiresIn}` : ''}` : `Token ${state}`,
    expiresIn,
    raw: line,
  };
}

async function runAuthCommand(args, timeout = 8000) {
  const { stdout, stderr } = await execFileAsync('bash', [authScript, ...args], {
    timeout,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  });

  return stripAnsi(`${stdout || ''}${stderr || ''}`).trim();
}

async function getStatus() {
  const profileSummary = parseAuthProfileSummary();
  let tokenRaw = '';

  try {
    const result = await execFileAsync(OPENCLAW_BIN, ['models', 'status'], {
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    });
    tokenRaw = `${result.stdout || ''}${result.stderr || ''}`;
  } catch (error) {
    tokenRaw = `${error.stdout || ''}${error.stderr || ''}`;
  }

  const labelsOutput = await runAuthCommand(['list']);
  const labels = labelsOutput
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.includes('auth profile'));

  return {
    agentId,
    currentLabel: readCurrentLabel(),
    labels,
    profile: profileSummary,
    token: parseTokenHealth(tokenRaw, profileSummary),
    bridge: {
      status: 'online',
      port: PORT,
      host: HOST,
      updatedAt: new Date().toISOString(),
      runtimeRefreshMs: RUNTIME_REFRESH_MS,
      authControlsLocalOnly: false,
      loginEnabled: Boolean(getDashboardLoginConfig()),
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 64) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function refreshRuntimeCache() {
  if (runtimeState.refreshing) {
    return runtimeState.data;
  }

  runtimeState.lastAttemptAt = new Date().toISOString();
  runtimeState.refreshing = true;

  try {
    await execFileAsync(process.execPath, [collectorScriptPath], {
      cwd: projectRoot,
      timeout: 25000,
      maxBuffer: 1024 * 1024 * 4,
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });

    const data = readRuntimeSnapshot();
    if (!data) {
      throw new Error('runtime-data.json was not produced');
    }

    runtimeState.data = data;
    runtimeState.error = null;
    runtimeState.lastSuccessAt = new Date().toISOString();
    return data;
  } catch (error) {
    runtimeState.error = error.message || 'Runtime refresh failed';
    throw error;
  } finally {
    runtimeState.refreshing = false;
  }
}

function getRuntimeAgeMs() {
  const generatedAt = runtimeState.data?.generatedAt;
  if (!generatedAt) return null;
  const age = Date.now() - new Date(generatedAt).getTime();
  return Number.isFinite(age) ? Math.max(0, age) : null;
}

function getRuntimePayload() {
  return {
    data: runtimeState.data,
    backend: {
      status: runtimeState.data ? 'online' : 'starting',
      host: HOST,
      port: PORT,
      refreshMs: RUNTIME_REFRESH_MS,
      staleMs: RUNTIME_STALE_MS,
      dataAgeMs: getRuntimeAgeMs(),
      refreshing: runtimeState.refreshing,
      lastAttemptAt: runtimeState.lastAttemptAt,
      lastSuccessAt: runtimeState.lastSuccessAt,
      error: runtimeState.error,
      authControlsLocalOnly: false,
      loginEnabled: Boolean(getDashboardLoginConfig()),
    },
  };
}

function bootRuntimeLoop() {
  const cached = readRuntimeSnapshot();
  if (cached) {
    runtimeState.data = cached;
    runtimeState.lastSuccessAt = cached.generatedAt || new Date().toISOString();
  }

  refreshRuntimeCache().catch((error) => {
    console.error(`[dashboard-backend] initial runtime refresh failed: ${error.message}`);
  });

  setInterval(async () => {
    try {
      await refreshRuntimeCache();
    } catch (error) {
      console.error(`[dashboard-backend] runtime refresh failed: ${error.message}`);
    }
  }, RUNTIME_REFRESH_MS).unref();
}

function mimeTypeFor(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath || '/');
  const normalized = path.posix.normalize(decoded);
  const relativePath = normalized === '/' ? 'index.html' : normalized.replace(/^\//, '');
  const candidate = path.join(distDir, relativePath);

  if (candidate.startsWith(distDir) && existsSync(candidate)) {
    return candidate;
  }

  const fallback = path.join(distDir, 'index.html');
  return existsSync(fallback) ? fallback : null;
}

async function serveStatic(req, res, url) {
  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    json(res, 503, {
      ok: false,
      error: 'Dashboard 前端还没 build。请先在项目目录执行 npm run build。',
    });
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypeFor(filePath),
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(body);
  } catch (error) {
    json(res, 500, { ok: false, error: error.message || '无法读取前端文件' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/session/status') {
      const login = getDashboardLoginConfig();
      const session = readSession(req);
      json(res, 200, {
        ok: true,
        data: {
          configured: Boolean(login),
          authenticated: Boolean(session),
          username: session?.username || null,
        },
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/session/login') {
      const login = getDashboardLoginConfig();
      if (!login) {
        json(res, 503, { ok: false, error: '控制台登录尚未配置。', configured: false });
        return;
      }

      const body = await readBody(req);
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');

      if (!passwordMatches(login.username, username) || !passwordMatches(login.password, password)) {
        json(res, 401, { ok: false, error: '用户名或密码不正确。', configured: true });
        return;
      }

      const token = createSession(login.username);
      setSessionCookie(res, token);
      json(res, 200, {
        ok: true,
        data: {
          configured: true,
          authenticated: true,
          username: login.username,
        },
        message: '登录成功。',
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/session/logout') {
      clearSessionCookie(res);
      json(res, 200, {
        ok: true,
        data: {
          configured: Boolean(getDashboardLoginConfig()),
          authenticated: false,
          username: null,
        },
        message: '已退出登录。',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/runtime') {
      if (!requireSession(req, res)) return;
      const ageMs = getRuntimeAgeMs();
      if (!runtimeState.refreshing && (!runtimeState.data || (ageMs !== null && ageMs > RUNTIME_STALE_MS))) {
        refreshRuntimeCache().catch((error) => {
          console.error(`[dashboard-backend] on-demand runtime refresh failed: ${error.message}`);
        });
      }
      json(res, 200, { ok: true, ...getRuntimePayload() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/runtime/refresh') {
      if (!requireSession(req, res)) return;
      const data = await refreshRuntimeCache();
      json(res, 200, {
        ok: true,
        data,
        backend: getRuntimePayload().backend,
        message: '运行快照已刷新。',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/status') {
      if (!requireSession(req, res)) return;
      json(res, 200, { ok: true, data: await getStatus() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/refresh') {
      if (!requireSession(req, res)) return;
      json(res, 200, { ok: true, data: await getStatus(), message: '授权状态已刷新。' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/save') {
      if (!requireSession(req, res)) return;
      const body = await readBody(req);
      const label = String(body?.label || '').trim();
      if (!safeLabel(label)) {
        json(res, 400, { ok: false, error: '标签不合法。只允许 1-40 位字母、数字、点、下划线、短横线。' });
        return;
      }

      const output = await runAuthCommand(['save', label]);
      json(res, 200, { ok: true, data: await getStatus(), message: output || `已保存当前授权：${label}` });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/switch') {
      if (!requireSession(req, res)) return;
      const body = await readBody(req);
      const label = String(body?.label || '').trim();
      if (!safeLabel(label)) {
        json(res, 400, { ok: false, error: '标签不合法。只允许 1-40 位字母、数字、点、下划线、短横线。' });
        return;
      }

      const output = await runAuthCommand(['switch', label]);
      json(res, 200, { ok: true, data: await getStatus(), message: output || `已切换到：${label}` });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/telegram/accounts') {
      if (!requireSession(req, res)) return;
      json(res, 200, {
        ok: true,
        data: {
          accounts: listTelegramAccounts(),
        },
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/telegram/send-file') {
      if (!requireSession(req, res)) return;
      const body = await readBody(req);
      const accountId = String(body?.accountId || 'default').trim() || 'default';
      const configTelegram = getDashboardTelegramConfig();
      const chatId = String(body?.chatId || configTelegram.defaultChatId || '').trim();
      const filePath = String(body?.filePath || '').trim();
      const caption = String(body?.caption || '').trim();
      const uploadedFile = body?.uploadedFile && typeof body.uploadedFile === 'object' ? body.uploadedFile : null;

      if (!chatId) {
        json(res, 400, { ok: false, error: '还没有配置默认 Telegram chatId。' });
        return;
      }

      if (!filePath && !uploadedFile) {
        json(res, 400, { ok: false, error: '请选择文件，或提供 filePath。' });
        return;
      }

      const result = await sendTelegramFile({ accountId, chatId, filePath, caption, uploadedFile });
      json(res, 200, {
        ok: true,
        data: result,
        message: `已通过 ${accountId} 发送${result.method === 'sendPhoto' ? '图片' : '文件'}：${result.fileName}`,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/gateway/restart') {
      if (!requireSession(req, res)) return;

      const child = spawn(OPENCLAW_BIN, ['gateway', 'restart'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, NO_COLOR: '1' },
      });
      child.unref();

      json(res, 200, {
        ok: true,
        data: {
          restartedAt: new Date().toISOString(),
        },
        message: '已发起 OpenClaw gateway 重启。',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        status: 'online',
        host: HOST,
        port: PORT,
        runtimeReady: Boolean(runtimeState.data),
        lastSuccessAt: runtimeState.lastSuccessAt,
        loginEnabled: Boolean(getDashboardLoginConfig()),
      });
      return;
    }

    // ── GET /api/metrics — system metrics ──
    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      if (!requireSession(req, res)) return;
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const uptimeStr = days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      const mem = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedPercent = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

      const cpus = os.cpus();
      const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
      const loadAvg = os.loadavg();

      json(res, 200, {
        ok: true,
        data: {
          cpu: { model: cpuModel, cores: cpus.length, loadAvg },
          memory: {
            total: totalMem,
            free: freeMem,
            usedPercent: `${usedPercent}%`,
            processRss: mem.rss,
            processHeap: mem.heapUsed,
          },
          uptime: uptimeStr,
          uptimeSeconds: uptime,
          node: process.version,
          platform: `${os.platform()} ${os.arch()}`,
          hostname: os.hostname(),
        },
      });
      return;
    }

    // ── GET /api/logs — recent log lines ──
    if (req.method === 'GET' && url.pathname === '/api/logs') {
      if (!requireSession(req, res)) return;
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 500);
      const logPath = path.join(os.homedir(), '.openclaw', 'logs', 'dashboard.log');
      let lines = [];
      if (existsSync(logPath)) {
        try {
          const content = readFileSync(logPath, 'utf8');
          lines = content.split('\n').filter(Boolean).slice(-limit);
        } catch { /* ignore read errors */ }
      }
      json(res, 200, { ok: true, data: { lines, count: lines.length, path: logPath } });
      return;
    }

    // ── POST /api/agents/:id/task — task dispatch stub (must be before GET /api/agents/:id) ──
    {
      const taskMatch = req.method === 'POST' && url.pathname.match(/^\/api\/agents\/([^/]+)\/task$/);
      if (taskMatch) {
        if (!requireSession(req, res)) return;
        const id = taskMatch[1];
        const body = await readBody(req);
        json(res, 200, {
          ok: true,
          data: {
            agentId: id,
            task: body,
            status: 'queued',
            queuedAt: new Date().toISOString(),
          },
          message: `任务已排队给 ${id}。`,
        });
        return;
      }
    }

    // ── GET /api/agents/:id — single agent ──
    {
      const agentMatch = req.method === 'GET' && url.pathname.match(/^\/api\/agents\/([^/]+)$/);
      if (agentMatch) {
        if (!requireSession(req, res)) return;
        const id = agentMatch[1];
        const agents = runtimeState.data?.runtime?.agents || runtimeState.data?.agents || [];
        const agent = Array.isArray(agents)
          ? agents.find((a) => a.id === id)
          : agents[id] || null;
        if (!agent) {
          json(res, 404, { ok: false, error: `Agent "${id}" not found` });
          return;
        }
        json(res, 200, { ok: true, data: agent });
        return;
      }
    }

    // ── GET /api/sessions/:id — single session ──
    {
      const sessMatch = req.method === 'GET' && url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessMatch) {
        if (!requireSession(req, res)) return;
        const id = sessMatch[1];
        const sessions = runtimeState.data?.runtime?.sessions || runtimeState.data?.sessions || [];
        const session = Array.isArray(sessions)
          ? sessions.find((s) => s.id === id || s.key === id)
          : null;
        if (!session) {
          json(res, 404, { ok: false, error: `Session "${id}" not found` });
          return;
        }
        json(res, 200, { ok: true, data: session });
        return;
      }
    }

    // ── GET /api/config — read dashboard config ──
    if (req.method === 'GET' && url.pathname === '/api/config') {
      if (!requireSession(req, res)) return;
      const configPath = path.join(os.homedir(), '.openclaw', 'dashboard-config.json');
      const config = readJsonMaybe(configPath) || {};
      json(res, 200, { ok: true, data: config, path: configPath });
      return;
    }

    // ── POST /api/config — merge update config ──
    if (req.method === 'POST' && url.pathname === '/api/config') {
      if (!requireSession(req, res)) return;
      const configPath = path.join(os.homedir(), '.openclaw', 'dashboard-config.json');
      const existing = readJsonMaybe(configPath) || {};
      const body = await readBody(req);
      const merged = { ...existing, ...body, updatedAt: new Date().toISOString() };
      try {
        const dir = path.dirname(configPath);
        if (!existsSync(dir)) {
          const { mkdirSync } = await import('node:fs');
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
        json(res, 200, { ok: true, data: merged, message: '配置已更新。' });
      } catch (error) {
        json(res, 500, { ok: false, error: error.message || '写入配置失败' });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/runtime-data.json') {
      if (!requireSession(req, res)) return;
      await serveStatic(req, res, url);
      return;
    }

    if (req.method === 'GET') {
      await serveStatic(req, res, url);
      return;
    }

    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: error.message || 'Unknown bridge error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dashboard backend listening at http://${HOST}:${PORT}`);
  bootRuntimeLoop();
});
