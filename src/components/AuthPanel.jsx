import { useMemo, useState } from 'react';
import { useAuthBridge } from '../hooks/useAuthBridge';

export function AuthPanel() {
  const { loading, saving, switching, data, error, message, refresh, saveCurrent, switchLabel, bridgeBase } = useAuthBridge();
  const [draftLabel, setDraftLabel] = useState('');
  const labels = data?.labels || [];
  const currentLabel = data?.currentLabel || '未知';
  const hasBridge = !error || data;

  const tokenStateLabelMap = {
    ok: '正常',
    expired: '已过期',
    missing: '缺失',
    error: '异常',
  };

  const tokenTone = useMemo(() => {
    const state = data?.token?.state;
    if (state === 'ok') return 'active';
    if (state === 'expired' || state === 'error' || state === 'missing') return 'queued';
    return '';
  }, [data?.token?.state]);

  async function handleSave() {
    const next = draftLabel.trim();
    if (!next) return;
    const ok = await saveCurrent(next);
    if (ok) {
      setDraftLabel('');
    }
  }

  return (
    <section className="panel auth-panel accent-violet">
      <div className="auth-panel-head">
        <div>
          <div className="eyebrow">授权</div>
          <h3>main 授权面板</h3>
          <p className="muted compact">
            通过本地 bridge 管理授权，变更限于本机执行。
          </p>
        </div>
        <div className="auth-head-actions">
          <span className={`pill ${loading ? 'queued' : 'active'}`}>{loading ? '读取中' : '桥接已连接'}</span>
          <button className="ghost-button" onClick={refresh} disabled={loading || saving || switching}>
            刷新状态
          </button>
        </div>
      </div>

      <div className="auth-grid">
        <div className="auth-card subtle-panel">
          <div className="auth-card-head">
            <span className="block-title">当前授权</span>
            <span className="chip">agent: main</span>
          </div>
          <div className="auth-kv-list">
            <div className="auth-kv-item">
              <span className="metric-label">当前标签</span>
              <strong>{currentLabel}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">配置键</span>
              <strong>{data?.profile?.profileKey || '未知'}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">提供方</span>
              <strong>{data?.profile?.provider || '未知'}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">账号类型</span>
              <strong>{data?.profile?.planType || '未知'}</strong>
            </div>
          </div>
          <div className="muted compact auth-path">{data?.profile?.filePath || '等待 bridge 返回授权文件路径...'}</div>
        </div>

        <div className="auth-card subtle-panel">
          <div className="auth-card-head">
            <span className="block-title">Token 状态</span>
            <span className={`pill ${tokenTone}`}>{tokenStateLabelMap[data?.token?.state] || data?.token?.state || '未知'}</span>
          </div>
          <div className="auth-kv-list">
            <div className="auth-kv-item">
              <span className="metric-label">摘要</span>
              <strong>{data?.token?.summary || '还没有可用摘要'}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">有效期</span>
              <strong>{data?.token?.expiresIn || data?.profile?.tokenExp || '未知'}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">已存标签</span>
              <strong>{labels.length}</strong>
            </div>
            <div className="auth-kv-item">
              <span className="metric-label">桥接地址</span>
              <strong>{hasBridge ? bridgeBase : '离线'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-actions-grid">
        <div className="auth-action-card subtle-panel">
          <div className="block-title">保存当前授权</div>
          <p className="muted compact">保存当前授权为标签</p>
          <div className="auth-form-row">
            <input
              className="auth-input"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="例如：个人 / 备用"
            />
            <button className="primary-button" onClick={handleSave} disabled={!draftLabel.trim() || saving || loading}>
              {saving ? '保存中...' : '保存当前'}
            </button>
          </div>
        </div>

        <div className="auth-action-card subtle-panel">
          <div className="block-title">切换已存标签</div>
          <p className="muted compact">已保存标签，点击切换</p>
          <div className="auth-label-list">
            {labels.length ? (
              labels.map((label) => (
                <button
                  key={label}
                  className={`label-button ${label === currentLabel ? 'label-button-active' : ''}`}
                  onClick={() => switchLabel(label)}
                  disabled={switching || label === currentLabel}
                >
                  <span>{label}</span>
                  <span className="muted compact">{label === currentLabel ? '当前' : '切换'}</span>
                </button>
              ))
            ) : (
              <div className="muted compact">暂无标签，先保存当前授权。</div>
            )}
          </div>
        </div>
      </div>

      {message ? <div className="auth-feedback success">{message}</div> : null}
      {error ? <div className="auth-feedback error">{error}</div> : null}
    </section>
  );
}
