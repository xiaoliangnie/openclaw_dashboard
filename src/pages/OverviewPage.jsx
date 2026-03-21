import { SectionHeader } from '../components/SectionHeader';
import { PixelAvatar } from '../components/PixelAvatar';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function OverviewPage() {
  const { heroSnapshot, overviewStats, agents, sessions, runtime, source, refreshing, recentActivity } = useDashboardRuntime();
  const activeAgents = agents.filter((agent) => agent.status === 'active').length;
  const liveSessions = runtime?.status?.sessions?.active ?? sessions.filter((item) => item.state === 'active').length;
  const idleSessions = sessions.filter((item) => item.state === 'idle').length;

  return (
    <div className="page-stack overview-page">
      <section className="hero panel hero-panel elevated-panel">
        <div className="hero-copy-block">
          <div className="eyebrow">总览</div>
          <h2>{getGreeting()}，先看会话和系统，再决定今天先动哪一块。</h2>

          <div className="hero-inline-metrics">
            <div className="hero-inline-card subtle-panel">
              <span className="metric-label">活跃角色</span>
              <strong>{activeAgents}</strong>
              <span className="muted compact">当前仍在推进中的常驻角色</span>
            </div>
            <div className="hero-inline-card subtle-panel">
              <span className="metric-label">活跃会话</span>
              <strong>{liveSessions}</strong>
              <span className="muted compact">需要优先关注的进行中链路</span>
            </div>
          </div>

          <div className="hero-agents-strip">
            {agents.filter((a) => a.status === 'active').map((a) => (
              <div key={a.id} className="hero-agent-chip">
                <PixelAvatar agentId={a.id} size="sm" />
                <span className="muted compact">{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-metrics panel subtle-panel hero-summary">
          <div>
            <div className="summary-head">
              <div className="eyebrow">{heroSnapshot.title}</div>
              <span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>
                {refreshing ? '后台刷新中' : source.label}
              </span>
            </div>
            <div className="summary-list">
              {heroSnapshot.items.map((item) => (
                <div key={item.label} className="summary-row">
                  <span className="muted compact">{item.label}</span>
                  <span className={`pill ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <p className="muted compact hero-note">{heroSnapshot.note}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="系统"
          title="核心状态"
          description="网关、Telegram、会话和模型都在这里收口。"
        />
        <div className="stats-grid">
          {overviewStats.map((item) => (
            <article key={item.label} className={`panel stat-card tone-${item.tone}`}>
              <div className="stat-top">
                <span className="stat-label">{item.label}</span>
                <span className="pill">{source.mode === 'backend' ? '实时' : source.mode === 'snapshot' ? '快照' : '后备'}</span>
              </div>
              <div className="stat-value">{item.value}</div>
              <p className="muted compact">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="会话"
          title="会话脉搏"
          description="把活跃、沉淀和需要继续推进的上下文先整理清楚。"
        />
        <div className="sessions-toolbar panel subtle-panel">
          <div>
            <div className="metric-label">会话总数</div>
            <strong>{sessions.length}</strong>
            <div className="muted compact">已做去重整理</div>
          </div>
          <div>
            <div className="metric-label">活跃中</div>
            <strong>{liveSessions}</strong>
            <div className="muted compact">优先查看这部分</div>
          </div>
          <div>
            <div className="metric-label">近期无新动作</div>
            <strong>{idleSessions}</strong>
            <div className="muted compact">可作为下一轮续接候选</div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="动态"
          title="最近动态"
          description="这里优先显示真实 runtime 的刷新结果，而不是固定示例。"
        />
        <div className="activity-list panel">
          {recentActivity.map((item) => (
            <div key={`${item.time}-${item.title}`} className="activity-item">
              <div className={`status-dot ${item.status === 'ok' ? 'ok' : 'warn'}`} />
              <div className="activity-time">{item.time}</div>
              <div>
                <div className="activity-title">{item.title}</div>
                <p className="muted compact">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
