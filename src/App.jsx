import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { AgentsPage } from './pages/AgentsPage';
import { SessionsPage } from './pages/SessionsPage';
import { SystemPage } from './pages/SystemPage';

function resolveBackendBase() {
  if (import.meta.env.VITE_DASHBOARD_BACKEND_URL) {
    return import.meta.env.VITE_DASHBOARD_BACKEND_URL;
  }

  if (import.meta.env.VITE_OCAUTH_BRIDGE_URL) {
    return import.meta.env.VITE_OCAUTH_BRIDGE_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port && port !== '5173') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
  }

  return 'http://127.0.0.1:4318';
}

const backendBase = resolveBackendBase();

function LoginPage({ loading, configured, error, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      return;
    }

    setSubmitting(true);
    await onLogin({ username: username.trim(), password });
    setSubmitting(false);
  }

  return (
    <div className="login-shell">
      <div className="login-panel panel elevated-panel">
        <div className="eyebrow">OpenClaw Dashboard</div>
        <h1>控制台登录</h1>
        <p className="muted login-copy">
          先登录，再查看运行状态、会话和系统操作。
        </p>

        {!configured ? (
          <div className="auth-feedback error">
            当前还没配置网页登录账号密码。先在 dashboard-config 或服务环境变量里写入登录账号后，再回来登录。
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="metric-label">账号</span>
            <input
              className="auth-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="输入用户名"
              autoComplete="username"
              disabled={!configured || loading || submitting}
            />
          </label>

          <label className="login-field">
            <span className="metric-label">密码</span>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              disabled={!configured || loading || submitting}
            />
          </label>

          <button
            type="submit"
            className="primary-button login-button"
            disabled={!configured || loading || submitting || !username.trim() || !password}
          >
            {submitting || loading ? '登录中...' : '登录进入控制台'}
          </button>
        </form>

        {error ? <div className="auth-feedback error">{error}</div> : null}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState({
    loading: true,
    configured: true,
    authenticated: false,
    username: null,
    error: null,
  });

  const refreshSession = useCallback(async () => {
    setSession((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${backendBase}/api/session/status`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `请求失败：${response.status}`);
      }

      setSession({
        loading: false,
        configured: Boolean(payload?.data?.configured),
        authenticated: Boolean(payload?.data?.authenticated),
        username: payload?.data?.username || null,
        error: null,
      });
    } catch (error) {
      setSession({
        loading: false,
        configured: true,
        authenticated: false,
        username: null,
        error: error.message || '控制台登录状态读取失败',
      });
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleLogin = useCallback(async ({ username, password }) => {
    try {
      const response = await fetch(`${backendBase}/api/session/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || payload?.message || `请求失败：${response.status}`);
      }

      setSession({
        loading: false,
        configured: true,
        authenticated: true,
        username: payload?.data?.username || username,
        error: null,
      });
    } catch (error) {
      setSession((prev) => ({
        ...prev,
        loading: false,
        authenticated: false,
        error: error.message || '登录失败',
      }));
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${backendBase}/api/session/logout`, { method: 'POST' });
    } catch {
      // ignore logout request errors, still clear local state
    }

    setSession((prev) => ({
      ...prev,
      authenticated: false,
      username: null,
      error: null,
    }));
  }, []);

  if (session.loading || !session.authenticated) {
    return (
      <LoginPage
        loading={session.loading}
        configured={session.configured}
        error={session.error}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Layout username={session.username} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
