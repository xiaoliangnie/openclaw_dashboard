import { useMemo, useState } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const kindLabelMap = {
  direct: '直接会话',
  slash: '命令入口',
  subagent: '子任务',
  cron: '定时任务',
  telegram: 'Telegram',
  main: '主控制台',
};

const filterOptions = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '活跃中' },
  { key: 'idle', label: '近期无新动作' },
  { key: 'queued', label: '已沉淀' },
];

export function SessionsPage() {
  const { sessions, runtime, source, refreshing } = useDashboardRuntime();
  const activeCount = runtime?.status?.sessions?.active ?? sessions.filter((s) => s.state === 'active').length;

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const counts = useMemo(() => ({
    all: sessions.length,
    active: sessions.filter((s) => s.state === 'active').length,
    idle: sessions.filter((s) => s.state === 'idle').length,
    queued: sessions.filter((s) => s.state === 'queued').length,
  }), [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (stateFilter !== 'all' && s.state !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (s.title || '').toLowerCase().includes(q) ||
          (s.summary || '').toLowerCase().includes(q) ||
          (s.id || '').toLowerCase().includes(q) ||
          (s.key || '').toLowerCase().includes(q) ||
          (s.agentLabel || '').toLowerCase().includes(q) ||
          (s.model || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, search, stateFilter]);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="会话"
        title="会话整理"
        description="先把正在推进的、可续接的、已经沉淀的上下文分清。"
        action={
          <span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>
            {refreshing ? '后台刷新中' : source.label}
          </span>
        }
      />

      <div className="sessions-filter-bar panel subtle-panel">
        <input
          className="sessions-search-input"
          type="text"
          placeholder="搜索角色、会话、模型或 key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-pills">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              className={`filter-pill${stateFilter === opt.key ? ' filter-pill-active' : ''}`}
              onClick={() => setStateFilter(opt.key)}
            >
              {opt.label} · {counts[opt.key] ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="sessions-toolbar panel subtle-panel">
        <div>
          <div className="metric-label">数据来源</div>
          <strong>{source.label}</strong>
          <div className="muted compact">{source.detail}</div>
        </div>
        <div>
          <div className="metric-label">最近刷新</div>
          <strong>{runtime?.generatedAt ? new Date(runtime.generatedAt).toLocaleString('zh-CN') : '未知'}</strong>
          <div className="muted compact">用于判断当前页是不是最新状态</div>
        </div>
        <div>
          <div className="metric-label">活跃会话</div>
          <strong>{activeCount}</strong>
          <div className="muted compact">优先关注这部分</div>
        </div>
      </div>

      <div className="session-list">
        {filtered.map((session) => (
          <article key={session.id} className="panel session-card session-card-runtime elevated-panel">
            <div className="session-top">
              <div>
                <div className="session-title-row">
                  <h3>{session.title}</h3>
                  {session.kind ? <span className="chip">{kindLabelMap[session.kind] || session.kind}</span> : null}
                </div>
                <p className="muted compact session-meta-line">
                  {session.agentLabel ? <span>{session.agentLabel}</span> : null}
                  {session.model ? <span>{session.model}</span> : null}
                  {session.age ? <span>{session.age}</span> : null}
                  {session.key ? <span>{session.key}</span> : null}
                </p>
              </div>
              <span className={`pill ${session.state}`}>{session.stateLabel || session.state}</span>
            </div>

            <p className="session-summary">{session.summary}</p>

            {session.tokens ? (
              <div className="session-context-badge">
                <span className="metric-label">上下文</span>
                <span className="chip">{session.tokens}</span>
              </div>
            ) : null}
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
            <p className="muted">没有匹配的会话</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
