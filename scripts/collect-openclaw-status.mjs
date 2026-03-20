import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const ayangWorkspaceRoot = process.env.AYANG_WORKSPACE_ROOT || '/Users/apple/.openclaw/workspace-ayang';
const outputPath = path.join(projectRoot, 'public', 'runtime-data.json');
const ayangPlanPath = path.join(ayangWorkspaceRoot, 'memory', 'ayang-daily-plan.json');
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/Users/apple/.npm-global/bin/openclaw';

function runOpenClaw(args) {
  try {
    return execFileSync(OPENCLAW_BIN, args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    throw new Error(`${OPENCLAW_BIN} ${args.join(' ')} failed\n${stdout}${stderr}`.trim());
  }
}

function matchValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`│\\s*${escaped}\\s*│\\s*([^│\n]+?)\\s*(?=│)`, 'i'),
    new RegExp(`${escaped}\\s*:\\s*(.+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function parseTableSection(text, sectionTitle) {
  const startIndex = text.indexOf(`\n${sectionTitle}\n`);
  if (startIndex === -1) {
    return [];
  }

  const afterTitle = text.slice(startIndex + sectionTitle.length + 2);
  const lines = afterTitle.split('\n');
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) {
      break;
    }

    if (!line.includes('│')) {
      continue;
    }

    const cells = line
      .split('│')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (!cells.length) {
      continue;
    }

    rows.push(cells);
  }

  if (rows.length <= 1) {
    return [];
  }

  const [header, ...body] = rows;

  return body
    .filter((cells) => cells.length === header.length)
    .filter((cells) => !cells.every((cell, index) => cell === header[index]))
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index]])));
}

function agentLabel(value) {
  return {
    main: '二弟',
    ayang: '阿羊',
    zhiyu: '知雨',
  }[value] || value || 'Agent';
}

function channelLabel(value) {
  return {
    telegram: 'Telegram',
    cron: '定时任务',
    subagent: '子任务',
    main: '主控制台',
  }[value] || value || '会话';
}

function modeLabel(value) {
  return {
    direct: '直聊',
    slash: '命令',
  }[value] || value || null;
}

function normalizeAge(value) {
  if (!value) return '未知';
  return value;
}

function deriveActivityState(age) {
  if (!age) {
    return { state: 'queued', stateLabel: '等待中' };
  }

  const normalized = String(age).replace(/\s+/g, '').toLowerCase();
  if (normalized === 'justnow') {
    return { state: 'active', stateLabel: '活跃中' };
  }

  const match = normalized.match(/^(\d+)([mhd])ago$/);
  if (!match) {
    return { state: 'queued', stateLabel: '已沉淀' };
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === 'm') {
    return { state: 'active', stateLabel: '活跃中' };
  }

  if (unit === 'h' && amount <= 6) {
    return { state: 'idle', stateLabel: '近期无新动作' };
  }

  return { state: 'queued', stateLabel: '已沉淀' };
}

function buildSessionTitle(session) {
  const parts = String(session.key || '').split(':').filter(Boolean);
  const agentId = parts[1] || 'agent';
  const surface = parts[2] || session.kind || 'session';
  const mode = parts[3] || null;

  if (surface === 'telegram') {
    return `Telegram · ${agentLabel(agentId)} · ${modeLabel(mode) || '会话'}`;
  }

  if (surface === 'subagent') {
    return `子任务 · ${agentLabel(agentId)}`;
  }

  if (surface === 'cron') {
    return `定时任务 · ${agentLabel(agentId)}`;
  }

  if (surface === 'main') {
    return `主控制台 · ${agentLabel(agentId)}`;
  }

  return `${channelLabel(surface)} · ${agentLabel(agentId)}`;
}

function buildSessionSummary(session) {
  const pieces = [];
  if (session.model) pieces.push(session.model);
  if (session.age) pieces.push(`最近活跃 ${session.age}`);
  if (session.tokens) pieces.push(session.tokens);
  return pieces.join(' · ') || '暂无摘要';
}

function parseModelStatus(text) {
  const defaultModel = matchValue(text, 'Default');
  const configuredModels = text.match(/Configured models \(\d+\)\s*:\s*(.+)/i)?.[1]?.trim() ?? null;

  const authProviders = [...text.matchAll(/-\s+([^\n]+?)\s*\n\s*-\s+([^\n]+?)\s+ok expires in\s+([^\n]+)/g)].map(
    ([, provider, profile, expiresIn]) => ({
      provider: provider.trim(),
      profile: profile.trim(),
      status: 'ok',
      expiresIn: expiresIn.trim(),
    }),
  );

  const primaryAuth = authProviders[0] ?? null;

  return {
    defaultModel,
    configuredModels,
    auth: {
      ok: Boolean(primaryAuth),
      provider: primaryAuth?.provider ?? null,
      profile: primaryAuth?.profile ?? null,
      expiresIn: primaryAuth?.expiresIn ?? null,
      summary: primaryAuth
        ? `${primaryAuth.provider} · ${primaryAuth.profile} · expires in ${primaryAuth.expiresIn}`
        : 'No healthy OAuth/token profile found',
      providers: authProviders,
    },
  };
}

function parseStatusDeep(text) {
  const gateway = matchValue(text, 'Gateway');
  const gatewayService = matchValue(text, 'Gateway service');
  const sessions = matchValue(text, 'Sessions');
  const updateValue = matchValue(text, 'Update');
  const telegramChannelDetail = text.match(/│\s*Telegram\s*│\s*ON\s*│\s*([^│\n]+?)\s*│\s*([^│\n]+?)\s*(?=│)/i);
  const healthGateway = text.match(/│\s*Gateway\s*│\s*([^│\n]+?)\s*│\s*([^│\n]+?)\s*(?=│)/i);
  const healthTelegram = text.match(/│\s*Telegram\s*│\s*([^│\n]+?)\s*│\s*([^│\n]+?)\s*(?=│)/i);
  const securitySummary = text.match(/Security audit\s*\nSummary:\s*(.+)/i)?.[1]?.trim() ?? null;
  const securityHeadline = text.match(/Security audit\s*\nSummary:\s*.+\n([^\n]+)/i)?.[1]?.trim() ?? null;
  const updateNotice = text.match(/Update available \((.+?)\)\. Run:\s*(.+)/i);
  const activeSessions = Number(sessions?.match(/(\d+)\s+active/i)?.[1] ?? 0);
  const gatewayReachable = gateway?.includes('reachable') || /reachable/i.test(healthGateway?.[1] ?? '');
  const sessionRows = parseTableSection(text, 'Sessions');
  const runtimeSessions = sessionRows.map((row, index) => {
    const session = {
      id: row.Key || `runtime-session-${index}`,
      key: row.Key || null,
      kind: row.Kind || null,
      age: normalizeAge(row.Age || null),
      model: row.Model || null,
      tokens: row.Tokens || null,
    };

    return {
      ...session,
      ...deriveActivityState(session.age),
      title: buildSessionTitle(session),
      summary: buildSessionSummary(session),
    };
  });

  return {
    gateway: {
      reachable: Boolean(gatewayReachable),
      summary: gateway,
      service: gatewayService,
      healthStatus: healthGateway?.[1]?.trim() ?? null,
      healthDetail: healthGateway?.[2]?.trim() ?? null,
    },
    telegram: {
      status: telegramChannelDetail?.[1]?.trim() ?? healthTelegram?.[1]?.trim() ?? null,
      detail: telegramChannelDetail?.[2]?.trim() ?? healthTelegram?.[2]?.trim() ?? null,
    },
    sessions: {
      active: activeSessions,
      summary: sessions,
      items: runtimeSessions,
    },
    update: {
      summary: updateNotice
        ? `Update available (${updateNotice[1]}). Run: ${updateNotice[2]}`
        : updateValue,
      detail: updateValue,
    },
    security: {
      summary: securitySummary,
      detail: securityHeadline,
    },
  };
}

function inferAgentMood(agentId, latest) {
  if (!latest) return '等待任务';
  if (latest.key?.includes(':telegram:')) return '正在处理对话';
  if (latest.key?.includes(':subagent:')) return '正在跑子任务';
  if (latest.key?.includes(':cron:')) return '来自定时任务';
  return `${agentLabel(agentId)} 最近有新动作`;
}

function inferAgentCard(agentId, sessions) {
  const list = sessions.filter((item) => String(item.key || '').includes(`agent:${agentId}:`));
  const latest = list[0] || null;
  const status = latest ? deriveActivityState(latest.age).state : 'idle';

  const meta = {
    main: {
      name: '二弟',
      role: '总控 / 编排',
      description: '负责主会话、任务路由、整合输出。',
      accent: 'blue',
    },
    ayang: {
      name: '阿羊',
      role: '技术前沿 / 工程探索',
      description: '偏新工具、AI 应用、系统玩法和方案探索。',
      accent: 'violet',
    },
    zhiyu: {
      name: '知雨',
      role: '研究 / 论文支持',
      description: '偏论文、文献、研究问题整理和方法路线。',
      accent: 'emerald',
    },
  }[agentId] || {
    name: agentLabel(agentId),
    role: 'Agent',
    description: 'Runtime-discovered agent',
    accent: 'blue',
  };

  return {
    id: agentId,
    ...meta,
    status,
    mood: inferAgentMood(agentId, latest),
    sessions: list.length,
    lastAction: latest ? `${latest.age} · ${latest.title}` : '暂无最近会话',
    latestSession: latest,
  };
}

function normalizeAyangPlan(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (parsed.current_plan && typeof parsed.current_plan === 'object') {
    const plan = parsed.current_plan;
    const materials = Array.isArray(plan.materials) ? plan.materials : [];
    const deliverables = Array.isArray(plan.deliverables) ? plan.deliverables : [];
    const acceptance = Array.isArray(plan.acceptance) ? plan.acceptance : [];
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];

    return {
      generatedAt: plan.date || null,
      owner: parsed.meta?.maintainer || parsed.meta?.owner || 'ayang',
      period: 'daily',
      title: '阿羊晨间计划',
      focus: plan.theme || '今日学习计划',
      summary: Array.isArray(plan.goals) && plan.goals.length
        ? `今天重点：${plan.goals.join('；')}`
        : '今日计划已同步。',
      tasks: tasks.map((task, index) => ({
        title: task.name || `任务 ${index + 1}`,
        goal: Array.isArray(task.focus) ? task.focus.join('；') : task.focus || '见今日计划',
        resource: materials[index]?.name || materials.map((item) => item.name).join('；') || '见阿羊资料建议',
        deliverable: deliverables[index] || deliverables.join('；') || '完成今日书面输出',
        status: plan.status || 'planned',
      })),
      notes: [
        ...(acceptance.length ? [`今日验收：${acceptance.join('；')}`] : []),
        ...(parsed.meta?.rule ? [`同步规则：${parsed.meta.rule}`] : []),
      ],
      links: [],
    };
  }

  if (Array.isArray(parsed.tasks)) {
    return parsed;
  }

  return null;
}

function loadAyangPlan() {
  if (!existsSync(ayangPlanPath)) {
    return null;
  }

  try {
    const raw = readFileSync(ayangPlanPath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeAyangPlan(parsed);
  } catch {
    return null;
  }
}

export function buildRuntimeData() {
  const modelText = runOpenClaw(['models', 'status']);
  const statusText = runOpenClaw(['status', '--deep']);

  const models = parseModelStatus(modelText);
  const status = parseStatusDeep(statusText);
  const runtimeSessions = status.sessions.items;
  const runtimeAgents = ['main', 'ayang', 'zhiyu'].map((agentId) => inferAgentCard(agentId, runtimeSessions));
  const ayangPlan = loadAyangPlan();

  return {
    generatedAt: new Date().toISOString(),
    source: 'openclaw-cli',
    models,
    status,
    runtime: {
      sessions: runtimeSessions,
      agents: runtimeAgents,
      ayangPlan,
    },
    raw: {
      modelsStatus: modelText,
      statusDeep: statusText,
    },
  };
}

export function writeRuntimeData(data = buildRuntimeData()) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return outputPath;
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === __filename;
}

if (isMainModule()) {
  try {
    const data = buildRuntimeData();
    const file = writeRuntimeData(data);
    console.log(`Wrote runtime data to ${file}`);
  } catch (error) {
    console.error('[collect-openclaw-status] Failed to refresh runtime data');
    console.error(error.message);
    process.exit(1);
  }
}
