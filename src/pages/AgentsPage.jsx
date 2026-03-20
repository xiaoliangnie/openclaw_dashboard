import { SectionHeader } from '../components/SectionHeader';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const statusLabelMap = {
  active: '活跃',
  idle: '空闲',
  queued: '等待中',
  warn: '需留意',
};

export function AgentsPage() {
  const { agents, runtime } = useDashboardRuntime();
  const activeCount = agents.filter((agent) => agent.status === 'active').length;
  const totalSessions = runtime?.runtime?.sessions?.length ?? agents.reduce((sum, agent) => sum + Number(agent.sessions || 0), 0);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="角色"
        title="常驻角色"
        description="agent 分工与活跃度"
        action={<span className="pill active">{activeCount} 个活跃 · {totalSessions} 条会话</span>}
      />

      <div className="agents-overview-strip panel subtle-panel">
        <div>
          <div className="metric-label">角色数</div>
          <strong>{agents.length}</strong>
          <div className="muted compact">当前常驻 agent</div>
        </div>
        <div>
          <div className="metric-label">活跃中</div>
          <strong>{activeCount}</strong>
          <div className="muted compact">最近仍在推进任务</div>
        </div>
        <div>
          <div className="metric-label">关联会话</div>
          <strong>{totalSessions}</strong>
          <div className="muted compact">按 runtime 信息汇总</div>
        </div>
      </div>

      <div className="agents-grid">
        {agents.map((agent) => (
          <article key={agent.id} className={`panel agent-card accent-${agent.accent}`}>
            <div>
              <div className="agent-head">
                <div>
                  <div className="eyebrow">{agent.role}</div>
                  <h3>{agent.name}</h3>
                </div>
                <span className={`pill ${agent.status}`}>{statusLabelMap[agent.status] || agent.status}</span>
              </div>

              <p className="muted">{agent.description}</p>

              <div className="agent-metrics">
                <div>
                  <span className="metric-label">最近状态</span>
                  <strong>{agent.mood}</strong>
                </div>
                <div>
                  <span className="metric-label">会话数</span>
                  <strong>{agent.sessions}</strong>
                </div>
              </div>
            </div>

            <div className="agent-foot muted compact">{agent.lastAction}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
