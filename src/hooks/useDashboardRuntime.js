import { useEffect, useState } from 'react';
import {
  agents as mockAgents,
  ayangPlan as mockAyangPlan,
  heroSnapshot,
  healthChecks,
  overviewStats,
  recentActivity as mockRecentActivity,
  sessions as mockSessions,
} from '../data/mockData';
import { getDashboardData } from '../data/runtimeData';

const fallbackData = {
  runtime: null,
  overviewStats,
  heroSnapshot,
  systemHealth: healthChecks,
  sessions: mockSessions,
  agents: mockAgents,
  ayangPlan: mockAyangPlan,
  recentActivity: mockRecentActivity,
  source: {
    mode: 'mock',
    label: '后备数据',
    detail: '暂未读取到本地运行状态，当前显示后备数据。',
    backend: null,
  },
  isFallback: true,
};

const POLL_MS = 10000;

export function useDashboardRuntime() {
  const [state, setState] = useState({
    ...fallbackData,
    loading: true,
    refreshing: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load({ initial = false } = {}) {
      setState((prev) => ({
        ...prev,
        loading: initial && !prev.runtime,
        refreshing: !initial,
      }));

      try {
        const data = await getDashboardData();
        if (cancelled) {
          return;
        }

        setState((prev) => ({
          ...prev,
          ...data,
          loading: false,
          refreshing: false,
          error: null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((prev) => {
          if (prev.runtime) {
            return {
              ...prev,
              loading: false,
              refreshing: false,
              error: error.message || '刷新失败',
              source: {
                ...prev.source,
                detail: '后台刷新失败，暂时保留上一份数据。',
              },
            };
          }

          return {
            ...fallbackData,
            loading: false,
            refreshing: false,
            error: error.message || '未能读取运行状态',
          };
        });
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        load({ initial: false });
      }
    }

    function handleFocus() {
      load({ initial: false });
    }

    load({ initial: true });
    const timer = setInterval(() => load({ initial: false }), POLL_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return state;
}
