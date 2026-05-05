import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// @ts-expect-error virtual module
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA only if NOT in an iframe (preview mode)
if (typeof window !== 'undefined' && window.self === window.top) {
  registerSW({ 
    immediate: true,
    onRegistered(r: any) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.error('SW Registration Error:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
