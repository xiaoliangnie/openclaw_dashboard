import { AuthPanel } from '../components/AuthPanel';
import { SectionHeader } from '../components/SectionHeader';
import { skillGroups } from '../data/mockData';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

export function SystemPage() {
  const { systemHealth, runtime, source, refreshing } = useDashboardRuntime();

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="系统"
        title="技能与系统健康"
        description="运行状态与授权操作"
        action={<span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>{refreshing ? '后台刷新中' : source.label}</span>}
      />

      <AuthPanel />

      <div className="system-grid">
        <section className="panel">
          <div className="system-health-head">
            <div className="block-title">技能分组</div>
            <span className="chip">当前视图</span>
          </div>
          <div className="skill-groups">
            {skillGroups.map((group) => (
              <div key={group.category} className="skill-group">
                <h3>{group.category}</h3>
                <div className="chip-row">
                  {group.items.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="system-health-head">
            <div className="block-title">系统健康</div>
            {runtime?.generatedAt ? <div className="muted compact">刷新于 {new Date(runtime.generatedAt).toLocaleString('zh-CN')}</div> : null}
          </div>
          <div className="health-list">
            {systemHealth.map((item) => (
              <div key={item.label} className="health-item">
                <div>
                  <div className="health-label">{item.label}</div>
                  <div className="muted compact">{item.trend}</div>
                </div>
                <div className="health-meta">
                  <strong>{item.value}</strong>
                  <span className={`status-dot ${item.status}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
