import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProvedorAutenticacao } from './autenticacao';
import './index.css';

const cliente = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <ProvedorAutenticacao>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ProvedorAutenticacao>
    </QueryClientProvider>
  </StrictMode>,
);
