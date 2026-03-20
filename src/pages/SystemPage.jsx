import { AuthPanel } from '../components/AuthPanel';
import { SectionHeader } from '../components/SectionHeader';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const metricsPlaceholder = [
  { label: 'CPU', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '内存', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '运行时间', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '平台', value: '--', detail: '等待 /api/metrics 接入' },
];

export function SystemPage() {
  const { systemHealth, runtime, source, refreshing } = useDashboardRuntime();

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="系统"
        title="系统健康"
        description="运行状态与授权操作"
        action={<span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>{refreshing ? '后台刷新中' : source.label}</span>}
      />

      <AuthPanel />

      <div className="system-grid">
        <section className="panel">
          <div className="system-health-head">
            <div className="block-title">系统指标</div>
            <span className="chip">占位</span>
          </div>
          <div className="system-metrics-grid">
            {metricsPlaceholder.map((m) => (
              <div key={m.label} className="system-metric-card subtle-panel">
                <div className="metric-label">{m.label}</div>
                <strong>{m.value}</strong>
                <div className="muted compact">{m.detail}</div>
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
