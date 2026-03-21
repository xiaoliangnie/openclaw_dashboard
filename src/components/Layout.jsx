import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: '总览', hint: '关键状态 · 今日重点', icon: '⌘' },
  { to: '/agents', label: '角色', hint: '分工 · 活跃度', icon: '◎' },
  { to: '/sessions', label: '会话', hint: '上下文 · 处理进度', icon: '⟡' },
  { to: '/system', label: '系统', hint: '健康 · 授权', icon: '⚙' },
];

export function Layout({ children, username, onLogout }) {
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
            <div className="eyebrow">访问状态</div>
            <div className="sidebar-overview-title">已登录控制台</div>
            <p className="muted compact">
              当前账号：{username || '未知用户'}
            </p>
          </div>

          <nav className="nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <div className="nav-main">
                  <span className="nav-index">{link.icon}</span>
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

        <div className="sidebar-footer">
          <button className="ghost-button sidebar-logout" onClick={onLogout}>退出登录</button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
