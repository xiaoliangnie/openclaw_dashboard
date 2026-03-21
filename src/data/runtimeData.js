import {
  agents as mockAgents,
  ayangPlan as mockAyangPlan,
  heroSnapshot,
  healthChecks,
  overviewStats,
  recentActivity as mockRecentActivity,
  sessions as mockSessions,
} from './mockData';

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
const statePriority = { active: 0, running: 0, idle: 1, queued: 2, completed: 3 };

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
      detail: payload.backend?.refreshing ? '后台正在刷新新一轮状态' : '由本地后台持续拉取 OpenClaw 运行状态',
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
      detail: '后台暂时不可用，当前显示最近一次成功落盘的数据',
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
    recentActivity: buildRecentActivity(runtime, source),
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

function formatGatewayHealth(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return '需检查';
  if (value === 'reachable') return '可达';
  if (value === 'ok' || value === 'online') return '在线';
  return status;
}

function formatSecurityState(summary) {
  const text = String(summary || '').trim();
  if (!text) {
    return { value: '未知', status: 'warn' };
  }

  if (/0\s*critical\s*·\s*0\s*warn|0\s*warn|no critical or warn/i.test(text)) {
    return { value: '正常', status: 'ok' };
  }

  if (/critical/i.test(text) && !/0\s*critical/i.test(text)) {
    return { value: '需处理', status: 'warn' };
  }

  return { value: '需留意', status: 'warn' };
}

function buildOverviewStats(runtime) {
  const { models = {}, status = {} } = runtime;

  return [
    {
      label: '网关',
      value: status.gateway?.reachable ? '在线' : '需检查',
      detail: status.gateway?.service || status.gateway?.summary || overviewStats[0].detail,
      tone: status.gateway?.reachable ? 'emerald' : 'amber',
    },
    {
      label: 'Telegram',
      value: status.telegram?.status || overviewStats[1].value,
      detail: status.telegram?.detail || overviewStats[1].detail,
      tone: /ok|stable/i.test(status.telegram?.status || '') ? 'blue' : 'amber',
    },
    {
      label: '会话',
      value: `${status.sessions?.active ?? 0} 条活跃`,
      detail: status.sessions?.summary || '来自 openclaw status --deep 的会话状态汇总',
      tone: (status.sessions?.active ?? 0) > 0 ? 'violet' : 'amber',
    },
    {
      label: '模型',
      value: models.defaultModel || overviewStats[3].value,
      detail: formatAuthDetail(models.auth) || models.configuredModels || overviewStats[3].detail,
      tone: models.auth?.ok ? 'blue' : 'amber',
    },
  ];
}

function buildHeroSnapshot(runtime) {
  const { models = {}, status = {}, generatedAt } = runtime;

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
        value: models.auth?.ok ? `正常 · ${models.auth?.expiresIn || '有效中'}` : '需检查',
        tone: models.auth?.ok ? 'ok' : 'warn',
      },
      {
        label: '最近刷新',
        value: formatGeneratedAt(generatedAt),
        tone: 'ok',
      },
    ],
    note:
      status.update?.summary ||
      `网关：${formatGatewayHealth(status.gateway?.healthStatus)} · Telegram：${status.telegram?.status || '未知'}`,
  };
}

function buildSystemHealth(runtime) {
  const { models = {}, status = {} } = runtime;
  const securityState = formatSecurityState(status.security?.summary);

  return [
    {
      label: '网关服务',
      value: formatGatewayHealth(status.gateway?.healthStatus || (status.gateway?.reachable ? '在线' : '需检查')),
      trend: status.gateway?.service || status.gateway?.healthDetail || healthChecks[0].trend,
      status: status.gateway?.reachable ? 'ok' : 'warn',
    },
    {
      label: '授权状态',
      value: models.auth?.ok ? '正常' : '需检查',
      trend: formatAuthDetail(models.auth) || healthChecks[1].trend,
      status: models.auth?.ok ? 'ok' : 'warn',
    },
    {
      label: '版本更新',
      value: status.update?.summary ? '可更新' : '已最新',
      trend: status.update?.summary || status.update?.detail || '没有发现更新提示',
      status: status.update?.summary ? 'warn' : 'ok',
    },
    {
      label: '安全巡检',
      value: securityState.value,
      trend: status.security?.summary || status.security?.detail || '没有读到安全巡检摘要',
      status: securityState.status,
    },
  ];
}

function deriveAgentId(session = {}) {
  const key = String(session.key || session.id || '');
  const parts = key.split(':');
  return parts[1] || session.agent || 'unknown';
}

function deriveSurface(session = {}) {
  const title = String(session.title || '');
  const key = String(session.key || '');
  if (title.includes('Telegram') || key.includes(':telegram:')) return 'telegram';
  if (title.includes('定时任务') || key.includes(':cron:')) return 'cron';
  if (title.includes('子任务') || key.includes(':subagent:')) return 'subagent';
  if (title.includes('主控制台') || key.endsWith(':main')) return 'main';
  return session.kind || 'direct';
}

function buildSessions(runtime) {
  const runtimeSessions = runtime?.runtime?.sessions;

  if (!Array.isArray(runtimeSessions) || runtimeSessions.length === 0) {
    return mockSessions;
  }

  const seen = new Set();

  return runtimeSessions
    .filter((session) => {
      const dedupeKey = session.key || session.id;
      if (!dedupeKey || seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    })
    .map((session) => {
      const agentId = deriveAgentId(session);
      const surface = deriveSurface(session);

      return {
        id: session.id || session.key,
        title: session.title || session.key || 'OpenClaw 会话',
        summary: session.summary || [session.kind, session.model, session.age].filter(Boolean).join(' · '),
        key: session.key,
        kind: surface,
        agent: agentId,
        agentLabel: agentId === 'main' ? '二弟' : agentId === 'ayang' ? '阿羊' : agentId === 'zhiyu' ? '知雨' : agentId,
        age: session.age,
        model: session.model,
        tokens: session.tokens,
        state: session.state || 'queued',
        stateLabel: session.stateLabel || '等待中',
      };
    })
    .sort((a, b) => {
      const byState = (statePriority[a.state] ?? 99) - (statePriority[b.state] ?? 99);
      if (byState !== 0) return byState;
      return compareAge(a.age, b.age);
    });
}

function compareAge(a, b) {
  return ageScore(a) - ageScore(b);
}

function ageScore(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const text = String(value).trim().toLowerCase();
  if (text === 'just now') return 0;
  const match = text.match(/^(\d+)\s*([mhd])\s*ago$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return amount;
  if (unit === 'h') return amount * 60;
  if (unit === 'd') return amount * 1440;
  return Number.MAX_SAFE_INTEGER;
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

function buildRecentActivity(runtime, source) {
  const items = [];
  const generatedAt = runtime?.generatedAt;
  const sessions = buildSessions(runtime);
  const activeSessions = sessions.filter((item) => item.state === 'active');

  if (generatedAt) {
    items.push({
      time: formatTimeLabel(generatedAt),
      title: source.mode === 'backend' ? '后台已刷新运行状态' : '当前显示最近一次快照',
      description: source.detail,
      status: source.mode === 'backend' ? 'ok' : 'warn',
    });
  }

  if (activeSessions.length > 0) {
    const first = activeSessions[0];
    items.push({
      time: first.age || '刚刚',
      title: `当前有 ${activeSessions.length} 条活跃会话`,
      description: `最新一条是「${first.title}」${first.summary ? `，${first.summary}` : ''}`,
      status: 'ok',
    });
  }

  if (runtime?.status?.gateway) {
    items.push({
      time: formatTimeLabel(generatedAt),
      title: runtime.status.gateway.reachable ? '网关状态正常' : '网关需要检查',
      description: runtime.status.gateway.service || runtime.status.gateway.summary || '等待网关状态详情',
      status: runtime.status.gateway.reachable ? 'ok' : 'warn',
    });
  }

  if (runtime?.status?.update?.summary) {
    items.push({
      time: formatTimeLabel(generatedAt),
      title: '发现可更新版本',
      description: runtime.status.update.summary,
      status: 'warn',
    });
  } else if (runtime?.status?.security?.summary) {
    items.push({
      time: formatTimeLabel(generatedAt),
      title: '安全巡检结果已更新',
      description: runtime.status.security.summary,
      status: /0\s*critical\s*·\s*0\s*warn|0\s*warn|no critical or warn/i.test(runtime.status.security.summary)
        ? 'ok'
        : 'warn',
    });
  }

  return items.length > 0 ? items.slice(0, 4) : mockRecentActivity;
}

function formatTimeLabel(value) {
  if (!value) return '--:--';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
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
