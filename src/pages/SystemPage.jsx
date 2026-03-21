import { useEffect, useState } from 'react';
import { AuthPanel } from '../components/AuthPanel';
import { SectionHeader } from '../components/SectionHeader';
import { useDashboardRuntime } from '../hooks/useDashboardRuntime';

const metricsPlaceholder = [
  { label: 'CPU', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '内存', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '运行时间', value: '--', detail: '等待 /api/metrics 接入' },
  { label: '平台', value: '--', detail: '等待 /api/metrics 接入' },
];

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

export function SystemPage() {
  const { systemHealth, runtime, source, refreshing } = useDashboardRuntime();
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState('');
  const [restartError, setRestartError] = useState('');
  const [telegramAccounts, setTelegramAccounts] = useState([]);
  const [telegramAccountId, setTelegramAccountId] = useState('default');
  const [telegramSelectedFile, setTelegramSelectedFile] = useState(null);
  const [telegramCaption, setTelegramCaption] = useState('');
  const [sendingTelegramFile, setSendingTelegramFile] = useState(false);
  const [telegramSendMessage, setTelegramSendMessage] = useState('');
  const [telegramSendError, setTelegramSendError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTelegramAccounts() {
      try {
        const response = await fetch(`${backendBase}/api/telegram/accounts`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || `请求失败：${response.status}`);
        }

        if (cancelled) return;
        const accounts = payload?.data?.accounts || [];
        setTelegramAccounts(accounts);
        if (accounts.length && !accounts.some((item) => item.id === telegramAccountId)) {
          setTelegramAccountId(accounts[0].id);
        }
      } catch (error) {
        if (cancelled) return;
        setTelegramSendError(error.message || '读取 Telegram 账号失败');
      }
    }

    loadTelegramAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRestartGateway() {
    setRestarting(true);
    setRestartError('');
    setRestartMessage('');

    try {
      const response = await fetch(`${backendBase}/api/gateway/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || payload?.message || `请求失败：${response.status}`);
      }

      setRestartMessage(payload?.message || '已发起 OpenClaw gateway 重启。');
    } catch (error) {
      setRestartError(error.message || '网关重启失败');
    } finally {
      setRestarting(false);
    }
  }

  async function handleSendTelegramFile() {
    setSendingTelegramFile(true);
    setTelegramSendMessage('');
    setTelegramSendError('');

    try {
      if (!telegramSelectedFile) {
        throw new Error('请先选择一个文件。');
      }

      const buffer = await telegramSelectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const contentBase64 = btoa(binary);

      const response = await fetch(`${backendBase}/api/telegram/send-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: telegramAccountId,
          caption: telegramCaption.trim(),
          uploadedFile: {
            fileName: telegramSelectedFile.name,
            mimeType: telegramSelectedFile.type || 'application/octet-stream',
            contentBase64,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || payload?.message || `请求失败：${response.status}`);
      }

      setTelegramSendMessage(payload?.message || '文件已发出。');
    } catch (error) {
      setTelegramSendError(error.message || '发送文件失败');
    } finally {
      setSendingTelegramFile(false);
    }
  }

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="系统"
        title="系统健康"
        description="运行状态与授权操作"
        action={<span className={`pill ${source.mode === 'backend' ? 'active' : source.mode === 'snapshot' ? 'warn' : 'queued'}`}>{refreshing ? '后台刷新中' : source.label}</span>}
      />

      <section className="panel auth-panel accent-blue">
        <div className="auth-panel-head">
          <div>
            <div className="eyebrow">网关控制</div>
            <h3>重启 OpenClaw gateway</h3>
            <p className="muted compact">
              登录后即可操作，不再单独要求输入重启密码。
            </p>
          </div>
          <div className="auth-head-actions">
            <span className="pill active">已受登录保护</span>
          </div>
        </div>

        <div className="auth-actions-grid">
          <div className="auth-action-card subtle-panel">
            <div className="block-title">直接重启</div>
            <p className="muted compact">
              适合远程处理“网关卡住但控制台还在线”的情况。点击后会直接发起 `openclaw gateway restart`。
            </p>
            <div className="auth-form-row">
              <button className="primary-button" onClick={handleRestartGateway} disabled={restarting}>
                {restarting ? '重启中...' : '重启网关'}
              </button>
            </div>
          </div>

          <div className="auth-action-card subtle-panel">
            <div className="block-title">边界</div>
            <div className="auth-kv-list">
              <div className="auth-kv-item">
                <span className="metric-label">访问方式</span>
                <strong>网页登录后可用</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">额外密码</span>
                <strong>不再需要</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">执行命令</span>
                <strong>openclaw gateway restart</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">当前策略</span>
                <strong>登录态控制</strong>
              </div>
            </div>
          </div>
        </div>

        {restartMessage ? <div className="auth-feedback success">{restartMessage}</div> : null}
        {restartError ? <div className="auth-feedback error">{restartError}</div> : null}
      </section>

      <section className="panel auth-panel accent-blue">
        <div className="auth-panel-head">
          <div>
            <div className="eyebrow">Telegram</div>
            <h3>文件回传桥</h3>
            <p className="muted compact">
              直接选文件并回传到你当前这个 Telegram 私聊。图片按图片发送，其它类型按文件发送。
            </p>
          </div>
          <div className="auth-head-actions">
            <span className="pill active">已登录可用</span>
          </div>
        </div>

        <div className="auth-actions-grid">
          <div className="auth-action-card subtle-panel">
            <div className="block-title">发送参数</div>
            <div className="auth-form-stack">
              <label className="login-field">
                <span className="metric-label">Telegram 账号</span>
                <select
                  className="auth-input"
                  value={telegramAccountId}
                  onChange={(event) => setTelegramAccountId(event.target.value)}
                  disabled={sendingTelegramFile}
                >
                  {telegramAccounts.length ? (
                    telegramAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name} · {account.id}</option>
                    ))
                  ) : (
                    <option value="default">default</option>
                  )}
                </select>
              </label>

              <label className="login-field">
                <span className="metric-label">选择本机文件</span>
                <input
                  className="auth-input file-input"
                  type="file"
                  onChange={(event) => setTelegramSelectedFile(event.target.files?.[0] || null)}
                  disabled={sendingTelegramFile}
                />
                <span className="muted compact">
                  {telegramSelectedFile ? `已选择：${telegramSelectedFile.name}` : '还没选文件'}
                </span>
              </label>

              <label className="login-field">
                <span className="metric-label">说明文字（可选）</span>
                <input
                  className="auth-input"
                  value={telegramCaption}
                  onChange={(event) => setTelegramCaption(event.target.value)}
                  placeholder="给文件带一句话"
                  disabled={sendingTelegramFile}
                />
              </label>

              <button
                className="primary-button"
                onClick={handleSendTelegramFile}
                disabled={sendingTelegramFile || !telegramSelectedFile}
              >
                {sendingTelegramFile ? '发送中...' : '发送到 Telegram'}
              </button>
            </div>
          </div>

          <div className="auth-action-card subtle-panel">
            <div className="block-title">说明</div>
            <div className="auth-kv-list">
              <div className="auth-kv-item">
                <span className="metric-label">发送方式</span>
                <strong>图片 / 文件自动判断</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">来源</span>
                <strong>默认回传到当前私聊</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">适合场景</span>
                <strong>截图、导出结果、日志文件一键回传</strong>
              </div>
              <div className="auth-kv-item">
                <span className="metric-label">当前限制</span>
                <strong>默认发给你当前这个 Telegram 私聊，暂不做多目标切换</strong>
              </div>
            </div>
          </div>
        </div>

        {telegramSendMessage ? <div className="auth-feedback success">{telegramSendMessage}</div> : null}
        {telegramSendError ? <div className="auth-feedback error">{telegramSendError}</div> : null}
      </section>

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
