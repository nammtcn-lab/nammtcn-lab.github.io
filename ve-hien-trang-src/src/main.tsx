import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { requestPersistence } from './store/db';
import './ui/styles.css';
import { exposeDebug } from './ui/editorBus';
import { store } from './store/store';

createRoot(document.getElementById('root')!).render(<App />);
void requestPersistence();
exposeDebug(store);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Không đăng ký được service worker', e));
  });
}
