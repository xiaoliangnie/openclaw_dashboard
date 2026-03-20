import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const runtimeDataPath = path.join(projectRoot, 'public', 'runtime-data.json');
const collectorScriptPath = path.join(projectRoot, 'scripts', 'collect-openclaw-status.mjs');

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.OCAUTH_BRIDGE_PORT || 4318);
const HOST = process.env.OCAUTH_BRIDGE_HOST || '127.0.0.1';
const RUNTIME_REFRESH_MS = Number(process.env.DASHBOARD_RUNTIME_REFRESH_MS || 30000);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/Users/apple/.npm-global/bin/openclaw';
const agentId = 'main';
const openclawDir = path.join(os.homedir(), '.openclaw');
const backupDir = path.join(os.homedir(), '.openclaw-auth-profiles');
const authScript = '/Users/apple/.openclaw/workspace/skills/openclaw-auth-switch/scripts/switch-openclaw-auth.sh';
const authFile = path.join(openclawDir, 'agents', agentId, 'agent', 'auth-profiles.json');
const currentLabelPath = path.join(backupDir, `.current_${agentId}`);

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

function requireLocal(req, res) {
  if (isLocalRequest(req)) {
    return true;
  }

  json(res, 403, {
    ok: false,
    error: '出于安全考虑，授权操作和手动刷新只允许在这台 Mac 本机访问。局域网访问默认是只读面板。',
  });
  return false;
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
      authControlsLocalOnly: true,
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

function getRuntimePayload() {
  return {
    data: runtimeState.data,
    backend: {
      status: runtimeState.data ? 'online' : 'starting',
      host: HOST,
      port: PORT,
      refreshMs: RUNTIME_REFRESH_MS,
      refreshing: runtimeState.refreshing,
      lastAttemptAt: runtimeState.lastAttemptAt,
      lastSuccessAt: runtimeState.lastSuccessAt,
      error: runtimeState.error,
      authControlsLocalOnly: true,
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
    if (req.method === 'GET' && url.pathname === '/api/runtime') {
      json(res, 200, { ok: true, ...getRuntimePayload() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/runtime/refresh') {
      if (!requireLocal(req, res)) return;
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
      if (!requireLocal(req, res)) return;
      json(res, 200, { ok: true, data: await getStatus() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/refresh') {
      if (!requireLocal(req, res)) return;
      json(res, 200, { ok: true, data: await getStatus(), message: '授权状态已刷新。' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/save') {
      if (!requireLocal(req, res)) return;
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
      if (!requireLocal(req, res)) return;
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

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        status: 'online',
        host: HOST,
        port: PORT,
        runtimeReady: Boolean(runtimeState.data),
        lastSuccessAt: runtimeState.lastSuccessAt,
      });
      return;
    }

    // ── GET /api/metrics — system metrics ──
    if (req.method === 'GET' && url.pathname === '/api/metrics') {
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
        if (!requireLocal(req, res)) return;
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
      const configPath = path.join(os.homedir(), '.openclaw', 'dashboard-config.json');
      const config = readJsonMaybe(configPath) || {};
      json(res, 200, { ok: true, data: config, path: configPath });
      return;
    }

    // ── POST /api/config — merge update config ──
    if (req.method === 'POST' && url.pathname === '/api/config') {
      if (!requireLocal(req, res)) return;
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
