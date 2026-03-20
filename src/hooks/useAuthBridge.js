import { useCallback, useEffect, useState } from 'react';

function resolveBridgeBase() {
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

const bridgeBase = resolveBridgeBase();

async function request(path, options = {}) {
  const response = await fetch(`${bridgeBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }

  return payload;
}

export function useAuthBridge() {
  const [state, setState] = useState({
    loading: true,
    saving: false,
    switching: false,
    data: null,
    error: null,
    message: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null, message: null }));
    try {
      const payload = await request('/api/auth/status');
      setState((prev) => ({ ...prev, loading: false, data: payload.data, error: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || '授权 bridge 当前不可用',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveCurrent = useCallback(async (label) => {
    setState((prev) => ({ ...prev, saving: true, error: null, message: null }));
    try {
      const payload = await request('/api/auth/save', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      setState((prev) => ({ ...prev, saving: false, data: payload.data, message: payload.message || '已保存。' }));
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || '保存失败' }));
      return false;
    }
  }, []);

  const switchLabel = useCallback(async (label) => {
    setState((prev) => ({ ...prev, switching: true, error: null, message: null }));
    try {
      const payload = await request('/api/auth/switch', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      setState((prev) => ({ ...prev, switching: false, data: payload.data, message: payload.message || '已切换。' }));
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, switching: false, error: error.message || '切换失败' }));
      return false;
    }
  }, []);

  return {
    ...state,
    bridgeBase,
    refresh,
    saveCurrent,
    switchLabel,
  };
}
