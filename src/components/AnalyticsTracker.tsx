import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { trackRole, trackScreen } from '../services/analytics';

/** Registra en la analítica cada pantalla (como plantilla) y el rol de la cuenta; no dibuja nada. */
export function AnalyticsTracker() {
  const { pathname } = useLocation();
  const role = useAuth().user?.role ?? null;
  useEffect(() => trackRole(role), [role]);
  useEffect(() => trackScreen(pathname), [pathname]);
  return null;
}
