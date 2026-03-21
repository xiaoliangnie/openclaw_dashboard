export const overviewStats = [
  {
    label: '网关',
    value: '在线',
    detail: '1 个 gateway 正在运行 · 心跳刚刚更新',
    tone: 'emerald',
  },
  {
    label: 'Telegram',
    value: '稳定',
    detail: '主要通道已连接 · 暂无明显投递延迟',
    tone: 'blue',
  },
  {
    label: '代理',
    value: '正常',
    detail: '延迟可接受 · 当前无需切换链路',
    tone: 'violet',
  },
  {
    label: '模型',
    value: '4 个可用',
    detail: 'GPT-5.4 / Claude / Gemini / DeepSeek',
    tone: 'amber',
  },
];

export const heroSnapshot = {
  title: '今日运行摘要',
  items: [
    { label: '总体状态', value: '稳定', tone: 'ok' },
    { label: '当前重点', value: '会话与系统健康', tone: 'ok' },
    { label: '提醒', value: '代理偶发波动', tone: 'warn' },
  ],
  note: '实时数据优先，方便快速判断当前状态与处理重点。',
};

export const ayangPlan = {
  title: '阿羊今日计划',
  focus: '等待今日计划更新',
  summary: '阿羊写入当天计划后，这里会显示今天的重点安排。',
  tasks: [
    {
      title: '等待今日安排同步',
      goal: '确认今天最重要的学习或研究目标',
      resource: '这里会显示当天资料或链接',
      deliverable: '这里会显示当天交付内容',
      status: 'planned',
    },
  ],
  notes: ['优先读取 memory/ayang-daily-plan.json。'],
};

export const recentActivity = [
  {
    time: '17:08',
    title: '控制台已创建',
    description: 'main 会话完成 openclaw-dashboard 工作区初始化。',
    status: 'in-progress',
  },
  {
    time: '16:42',
    title: 'Telegram 主通道稳定',
    description: '直接聊天通道可用，最近一次心跳返回正常。',
    status: 'ok',
  },
  {
    time: '15:56',
    title: '技能索引已刷新',
    description: '本地技能列表更新完成，可用于后续检索与展示。',
    status: 'ok',
  },
  {
    time: '14:21',
    title: '代理延迟出现波动',
    description: '峰值一度升高，随后已回落到安全区间。',
    status: 'warn',
  },
];

export const agents = [
  {
    id: 'main',
    name: '二弟',
    role: '总控 / 编排',
    mood: '专注推进',
    status: 'active',
    description: '负责主会话、任务路由、结果整合和最终回应。',
    sessions: 12,
    lastAction: '2 分钟前处理了一轮 Telegram 对话',
    accent: 'blue',
  },
  {
    id: 'ayang',
    name: '阿羊',
    role: '前沿技术 / 工程探索',
    mood: '观察中',
    status: 'idle',
    description: '适合处理新工具、新框架、实践方案对比和技术验证。',
    sessions: 5,
    lastAction: '28 分钟前完成一轮方案调研',
    accent: 'violet',
  },
  {
    id: 'zhiyu',
    name: '知雨',
    role: '研究 / 论文支持',
    mood: '在读资料',
    status: 'active',
    description: '处理研究型问题、文献阅读和系统化摘要。',
    sessions: 8,
    lastAction: '9 分钟前整理了一批研究笔记',
    accent: 'emerald',
  },
  {
    id: 'codery',
    name: 'Codery',
    role: '项目编程 / 工程交付',
    mood: '等待任务',
    status: 'idle',
    description: '专门负责做项目、写代码、修 bug、重构和工程交付。',
    sessions: 0,
    lastAction: '等待第一条编程任务接入',
    accent: 'blue',
  },
];

export const sessions = [
  {
    id: 'sess-9012',
    title: 'Telegram 直聊 · Dashboard 维护',
    agent: 'main',
    channel: 'telegram',
    updatedAt: '今天 17:15',
    state: 'running',
    stateLabel: '进行中',
    summary: '正在更新控制台页面与基础展示。',
  },
  {
    id: 'sess-9001',
    title: 'Heartbeat 日常维护',
    agent: 'main',
    channel: 'system',
    updatedAt: '今天 16:20',
    state: 'completed',
    stateLabel: '已完成',
    summary: '已检查 memory 与最近状态，没有发现异常。',
  },
  {
    id: 'sess-8973',
    title: '技能整理记录',
    agent: 'ayang',
    channel: 'local',
    updatedAt: '今天 14:08',
    state: 'completed',
    stateLabel: '已完成',
    summary: '整理了当前 skill 结构和可优化项。',
  },
  {
    id: 'sess-8939',
    title: '论文支持会话',
    agent: 'zhiyu',
    channel: 'telegram',
    updatedAt: '昨天 21:44',
    state: 'queued',
    stateLabel: '等待中',
    summary: '等待继续处理下一轮文献筛选。',
  },
];

export const healthChecks = [
  {
    label: '网关服务',
    value: '正常',
    trend: '最近一轮检测可达',
    status: 'ok',
  },
  {
    label: '授权状态',
    value: '稳定',
    trend: '当前 token 仍在有效期内',
    status: 'ok',
  },
  {
    label: '工作区体积',
    value: '需留意',
    trend: '本周文件量有增长，后续可安排清理',
    status: 'warn',
  },
  {
    label: '定时与心跳',
    value: '正常',
    trend: '轻量巡检运行正常',
    status: 'ok',
  },
];
