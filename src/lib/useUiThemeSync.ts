import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { uiThemeApi } from '@/api/endpoints';
import { useAppDispatch } from '@/store';
import { uiThemeLoaded, uiThemeUnavailable } from '@/store/uiSlice';

export const UI_THEME_QUERY_KEY = ['ui-theme'] as const;

/**
 * Keeps the application look in step with the API: fetched once on load, re-checked every
 * ten minutes (so a change by the Super Admin reaches open sessions), and refetched at once
 * when the Super Admin changes it here. Never per render: TanStack Query holds the result.
 */
export function useUiThemeSync() {
  const dispatch = useAppDispatch();

  const query = useQuery({
    queryKey: UI_THEME_QUERY_KEY,
    queryFn: uiThemeApi.get,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) dispatch(uiThemeLoaded(query.data));
  }, [query.data, dispatch]);

  useEffect(() => {
    if (!query.error) return;
    // An API without this feature answers 404: that is a definite "VPS look". Anything else
    // (network, timeout, 5xx) keeps the last known look, or VPS when there is none.
    if (isAxiosError(query.error) && query.error.response?.status === 404) {
      dispatch(uiThemeLoaded({ mode: 'VPS', tokens: {} }));
    } else {
      dispatch(uiThemeUnavailable());
    }
  }, [query.error, dispatch]);
}
