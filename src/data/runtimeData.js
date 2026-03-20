import { agents as mockAgents, ayangPlan as mockAyangPlan, heroSnapshot, healthChecks, overviewStats, sessions as mockSessions } from './mockData';

function resolveBackendBase() {
  if (import.meta.env.VITE_DASHBOARD_BACKEND_URL) {
    return import.meta.env.VITE_DASHBOARD_BACKEND_URL;
  }

  if (import.meta.env.VITE_OCAUTH_BRIDGE_URL) {
    return import.meta.env.VITE_OCAUTH_BRIDGE_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port && port !== '5173') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
  }

  return 'http://127.0.0.1:4318';
}

const backendBase = resolveBackendBase();

async function loadRuntimeFromBackend() {
  const response = await fetch(`${backendBase}/api/runtime`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`backend runtime request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.data?.generatedAt) {
    throw new Error('backend runtime payload is empty');
  }

  return {
    runtime: payload.data,
    source: {
      mode: 'backend',
      label: '常驻后台',
      detail: payload.backend?.refreshing ? '后台正在刷新新一轮状态' : '由本地后台定时拉取 OpenClaw 状态',
      backend: payload.backend || null,
    },
  };
}

async function loadRuntimeFromSnapshot() {
  const response = await fetch('/runtime-data.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`runtime-data request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.generatedAt) {
    throw new Error('runtime-data is empty');
  }

  return {
    runtime: data,
    source: {
      mode: 'snapshot',
      label: '静态快照',
      detail: '后台暂时不可用，当前显示最近一次落盘数据',
      backend: null,
    },
  };
}

async function loadRuntimeJson() {
  try {
    return await loadRuntimeFromBackend();
  } catch {
    return loadRuntimeFromSnapshot();
  }
}

export async function getDashboardData() {
  const { runtime, source } = await loadRuntimeJson();

  const isFallback = source.mode !== 'backend';

  return {
    runtime,
    overviewStats: buildOverviewStats(runtime),
    heroSnapshot: buildHeroSnapshot(runtime),
    systemHealth: buildSystemHealth(runtime),
    sessions: buildSessions(runtime),
    agents: buildAgents(runtime),
    ayangPlan: buildAyangPlan(runtime),
    source,
    isFallback,
  };
}

function formatAuthDetail(auth) {
  if (!auth) return '未读到授权状态';
  if (!auth.ok) return '授权状态异常';
  const provider = auth.provider || '未知提供方';
  const profile = auth.profile || '默认配置';
  const expiresIn = auth.expiresIn ? ` · 剩余 ${auth.expiresIn}` : '';
  return `${provider} · ${profile}${expiresIn}`;
}

function buildOverviewStats(runtime) {
  const { models, status } = runtime;

  return [
    {
      label: '网关',
      value: status.gateway.reachable ? '在线' : '需检查',
      detail: status.gateway.service || status.gateway.summary || overviewStats[0].detail,
      tone: status.gateway.reachable ? 'emerald' : 'amber',
    },
    {
      label: 'Telegram',
      value: status.telegram.status || overviewStats[1].value,
      detail: status.telegram.detail || overviewStats[1].detail,
      tone: /ok|stable/i.test(status.telegram.status || '') ? 'blue' : 'amber',
    },
    {
      label: '会话',
      value: `${status.sessions.active} 条活跃`,
      detail: status.sessions.summary || '来自 openclaw status --deep 的会话计数',
      tone: status.sessions.active > 0 ? 'violet' : 'amber',
    },
    {
      label: '模型',
      value: models.defaultModel || overviewStats[3].value,
      detail: formatAuthDetail(models.auth) || models.configuredModels || overviewStats[3].detail,
      tone: models.auth.ok ? 'amber' : 'violet',
    },
  ];
}

function buildHeroSnapshot(runtime) {
  const { models, status, generatedAt } = runtime;

  return {
    title: '今日运行摘要',
    items: [
      {
        label: '默认模型',
        value: models.defaultModel || heroSnapshot.items[0].value,
        tone: models.defaultModel ? 'ok' : 'warn',
      },
      {
        label: '授权状态',
        value: models.auth.ok ? `正常 · ${models.auth.expiresIn}` : '需检查',
        tone: models.auth.ok ? 'ok' : 'warn',
      },
      {
        label: '最近刷新',
        value: formatGeneratedAt(generatedAt),
        tone: 'ok',
      },
    ],
    note:
      status.update.summary ||
      `网关：${status.gateway.healthStatus || '未知'} · Telegram：${status.telegram.status || '未知'}`,
  };
}

function buildSystemHealth(runtime) {
  const { models, status } = runtime;

  return [
    {
      label: '网关服务',
      value: status.gateway.healthStatus || (status.gateway.reachable ? '在线' : '未知'),
      trend: status.gateway.service || status.gateway.healthDetail || healthChecks[0].trend,
      status: status.gateway.reachable ? 'ok' : 'warn',
    },
    {
      label: '授权状态',
      value: models.auth.ok ? '正常' : '需检查',
      trend: formatAuthDetail(models.auth) || healthChecks[1].trend,
      status: models.auth.ok ? 'ok' : 'warn',
    },
    {
      label: '版本更新',
      value: status.update.summary ? '可更新' : '已最新',
      trend: status.update.summary || status.update.detail || '没有发现更新提示',
      status: status.update.summary ? 'warn' : 'ok',
    },
    {
      label: '安全巡检',
      value: status.security.summary || healthChecks[3].value,
      trend: status.security.detail || '没有读到安全巡检摘要',
      status: /0 warn|no critical or warn/i.test(status.security.summary || '') ? 'ok' : 'warn',
    },
  ];
}

function buildSessions(runtime) {
  const runtimeSessions = runtime?.runtime?.sessions;

  if (!Array.isArray(runtimeSessions) || runtimeSessions.length === 0) {
    return mockSessions;
  }

  return runtimeSessions.map((session) => ({
    id: session.id || session.key,
    title: session.title || session.key || 'OpenClaw 会话',
    summary: session.summary || [session.kind, session.model, session.age].filter(Boolean).join(' · '),
    key: session.key,
    kind: session.kind,
    age: session.age,
    model: session.model,
    tokens: session.tokens,
    state: session.state || 'queued',
    stateLabel: session.stateLabel || '等待中',
  }));
}

function buildAgents(runtime) {
  const runtimeAgents = runtime?.runtime?.agents;
  if (!Array.isArray(runtimeAgents) || runtimeAgents.length === 0) {
    return mockAgents;
  }

  return runtimeAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    mood: agent.mood,
    status: agent.status,
    description: agent.description,
    sessions: agent.sessions,
    lastAction: agent.lastAction,
    accent: agent.accent || 'blue',
  }));
}

function buildAyangPlan(runtime) {
  const plan = runtime?.runtime?.ayangPlan;
  if (!plan || typeof plan !== 'object') {
    return mockAyangPlan;
  }

  return {
    title: plan.title || mockAyangPlan.title,
    focus: plan.focus || mockAyangPlan.focus,
    summary: plan.summary || mockAyangPlan.summary,
    tasks: Array.isArray(plan.tasks) && plan.tasks.length > 0 ? plan.tasks : mockAyangPlan.tasks,
    notes: Array.isArray(plan.notes) ? plan.notes : mockAyangPlan.notes,
    generatedAt: plan.generatedAt || null,
  };
}

function formatGeneratedAt(value) {
  if (!value) {
    return '未知';
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
