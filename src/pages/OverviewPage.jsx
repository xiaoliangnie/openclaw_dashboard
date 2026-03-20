import { SectionHeader } from '../components/SectionHeader';
import { recentActivity } from '../data/mockData';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

export function OverviewPage() {
  const { ayangPlan, heroSnapshot, overviewStats, agents, sessions, runtime, source, refreshing } = useDashboardRuntime();
  const activeAgents = agents.filter((agent) => agent.status === 'active').length;
  const liveSessions = runtime?.status?.sessions?.active ?? sessions.length;

  return (
    <div className="page-stack">
      <section className="hero panel hero-panel elevated-panel">
        <div className="hero-copy-block">
          <div className="eyebrow">总览</div>
          <h2>全局状态一览</h2>
          <p className="muted hero-copy">
            聚合运行、授权与任务状态，快速定位优先事项。
          </p>

          <div className="hero-inline-metrics">
            <div className="hero-inline-card subtle-panel">
              <span className="metric-label">活跃角色</span>
              <strong>{activeAgents}</strong>
              <span className="muted compact">持续推进中的 agent</span>
            </div>
            <div className="hero-inline-card subtle-panel">
              <span className="metric-label">活跃会话</span>
              <strong>{liveSessions}</strong>
              <span className="muted compact">当前活跃会话数</span>
            </div>
          </div>
        </div>

        <div className="hero-metrics panel subtle-panel hero-summary">
          <div className="signal" />
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
            <p className="muted compact hero-note">{source.detail}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="系统"
          title="核心状态"
          description="网关 / Telegram / 会话 / 模型"
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

      <section className="overview-lower-grid">
        <div className="page-stack compact-stack">
          <section>
            <SectionHeader
              eyebrow="阿羊"
              title="阿羊今日计划"
              description="聚焦今天的安排、目标与交付。"
            />
            <div className="plan-panel panel">
              <div className="plan-head">
                <div>
                  <div className="eyebrow">{ayangPlan.title}</div>
                  <h3>{ayangPlan.focus}</h3>
                </div>
                <span className={`pill ${ayangPlan.generatedAt ? 'active' : 'queued'}`}>{ayangPlan.generatedAt ? '已更新' : '待同步'}</span>
              </div>
              <p className="muted">{ayangPlan.summary}</p>
              <div className="plan-task-list">
                {ayangPlan.tasks.slice(0, 3).map((task, index) => (
                  <div key={`${task.title}-${index}`} className="plan-task-item">
                    <div className="plan-task-title">{task.title}</div>
                    <div className="plan-task-field">
                      <span className="eyebrow">目标</span>
                      <span>{task.goal}</span>
                    </div>
                    <div className="plan-task-field">
                      <span className="eyebrow">资料</span>
                      <span>{task.resource}</span>
                    </div>
                    <div className="plan-task-field">
                      <span className="eyebrow">交付</span>
                      <span>{task.deliverable}</span>
                    </div>
                  </div>
                ))}
              </div>
              {Array.isArray(ayangPlan.notes) && ayangPlan.notes.length > 0 ? (
                <div className="plan-notes muted compact">备注：{ayangPlan.notes[0]}</div>
              ) : null}
            </div>
          </section>
        </div>

        <section>
          <SectionHeader
            eyebrow="动态"
            title="最近动态"
            description="查看近几次关键更新与状态变化。"
          />
          <div className="activity-list panel">
            {recentActivity.map((item) => (
              <div key={`${item.time}-${item.title}`} className="activity-item">
                <div className={`status-dot ${item.status}`} />
                <div className="activity-time">{item.time}</div>
                <div>
                  <div className="activity-title">{item.title}</div>
                  <p className="muted compact">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
