import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: '总览', hint: '关键状态 · 今日重点' },
  { to: '/agents', label: '角色', hint: '分工 · 活跃度' },
  { to: '/sessions', label: '会话', hint: '上下文 · 处理进度' },
  { to: '/system', label: '系统', hint: '健康 · 技能 · 授权' },
];

export function Layout({ children }) {
  return (
    <div className="shell">
      <aside className="sidebar panel">
        <div className="sidebar-stack">
          <div className="sidebar-top">
            <div className="sidebar-badge">OpenClaw</div>
            <h1>个人 AI 控制台</h1>
            <p className="muted sidebar-copy">
              一站掌握网关、模型、会话与角色状态。
            </p>
          </div>

          <div className="sidebar-overview subtle-panel">
            <div className="eyebrow">运行数据</div>
            <div className="sidebar-overview-title">本地实时状态</div>
            <p className="muted compact">
              优先本地 runtime，不可用时自动回退快照。
            </p>
          </div>

          <nav className="nav">
            {links.map((link, index) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <div className="nav-main">
                  <span className="nav-index">0{index + 1}</span>
                  <div>
                    <div className="nav-label">{link.label}</div>
                    <div className="nav-hint">{link.hint}</div>
                  </div>
                </div>
                <span className="nav-dot" />
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer panel subtle-panel">
          <div className="eyebrow">当前状态</div>
          <div className="sidebar-footer-title">轻量设计</div>
          <p className="muted compact">
            聚焦高频信息，快速确认状态。
          </p>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
