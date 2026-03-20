import { useState, useMemo } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const kindLabelMap = {
  direct: '直接会话',
  slash: '斜杠命令',
  subagent: '子任务',
};

const filterOptions = [
  { key: 'all', label: '全部' },
  { key: 'running', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'queued', label: '等待中' },
];

export function SessionsPage() {
  const { sessions, runtime, source, refreshing } = useDashboardRuntime();
  const activeCount = runtime?.status?.sessions?.active ?? sessions.length;

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (stateFilter !== 'all' && s.state !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (s.title || '').toLowerCase().includes(q) ||
          (s.summary || '').toLowerCase().includes(q) ||
          (s.id || '').toLowerCase().includes(q) ||
          (s.agent || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, search, stateFilter]);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="会话"
        title="最近会话"
        description="上下文、模型与活跃状态"
        action={<span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>{refreshing ? '后台刷新中' : source.label}</span>}
      />

      <div className="sessions-filter-bar panel subtle-panel">
        <input
          className="sessions-search-input"
          type="text"
          placeholder="搜索会话…"
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
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sessions-toolbar panel subtle-panel">
        <div>
          <div className="metric-label">数据来源</div>
          <strong>{source.label}</strong>
        </div>
        <div>
          <div className="metric-label">最近刷新</div>
          <strong>{runtime?.generatedAt ? new Date(runtime.generatedAt).toLocaleString('zh-CN') : '未知'}</strong>
        </div>
        <div>
          <div className="metric-label">活跃会话</div>
          <strong>{activeCount}</strong>
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
                  <span>{session.key || session.id}</span>
                  {session.model ? <span>{session.model}</span> : null}
                  {session.age ? <span>{session.age}</span> : null}
                </p>
              </div>
              <span className={`pill ${session.state}`}>{session.stateLabel || session.tokens || session.state}</span>
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
