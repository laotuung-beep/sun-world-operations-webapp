import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { AuthProvider } from './auth/AuthProvider';
import App from './App';
import './index.css';

// Màn xem thử với người dùng giả, chỉ có khi chạy `npm run dev` (không vào bản build).
const Preview = import.meta.env.DEV ? lazy(() => import('./dev/Preview').then((m) => ({ default: m.Preview }))) : null;
const showPreview = new URLSearchParams(location.search).has('preview');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Preview && showPreview ? (
      <Suspense>
        <Preview />
      </Suspense>
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
    <Toaster position="top-center" richColors closeButton />
  </StrictMode>,
);
