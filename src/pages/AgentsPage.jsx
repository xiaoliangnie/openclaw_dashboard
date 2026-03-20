import { SectionHeader } from '../components/SectionHeader';
import { PixelAvatar } from '../components/PixelAvatar';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const statusLabelMap = {
  active: '活跃',
  idle: '空闲',
  queued: '等待中',
  warn: '需留意',
};

export function AgentsPage() {
  const { agents, ayangPlan, runtime } = useDashboardRuntime();
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
              <div className="agent-avatar-row">
                <PixelAvatar agentId={agent.id} size="md" />
                <div>
                  <div className="eyebrow">{agent.role}</div>
                  <h3>{agent.name}</h3>
                  <span className={`pill ${agent.status}`}>{statusLabelMap[agent.status] || agent.status}</span>
                </div>
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

      {ayangPlan && ayangPlan.tasks && ayangPlan.tasks.length > 0 ? (
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
      ) : null}
    </div>
  );
}
