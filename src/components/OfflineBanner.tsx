import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Aviso cuando el dispositivo pierde la conexión a Internet. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={18} /> Sin conexión. Reintentaremos automáticamente.
    </div>
  );
}
