import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@/store';
import { App } from '@/App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Government data changes on human timescales; a short stale window keeps screens
      // responsive without hammering the API, and retrying a failed government API call
      // repeatedly rarely helps, so retries are kept to one.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Serve correctly whether the app is hosted at the site root or under a sub-path (e.g. an
// IIS application at /VPS). Vite bakes the build's `base` into import.meta.env.BASE_URL
// ('/' at root, '/VPS/' under a sub-path); the router uses it (minus the trailing slash) so
// client-side routes resolve under that same prefix.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={routerBasename}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);
