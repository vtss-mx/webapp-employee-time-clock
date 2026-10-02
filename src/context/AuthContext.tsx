import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, configureApiClient, TOUCH_DEVICE_REQUIRED } from '../services/apiClient';
import type { ApiErrorItem } from '../services/apiClient';
import { authService } from '../services/authService';
import { meService } from '../services/meService';
import type { AuthTokenResponse, Session, User, UserPreferences } from '../types';
import { preferenceStore } from '../utils/storage';

/** Indicador NO sensible: solo dice que vale la pena intentar restaurar la sesión al recargar. */
const SIGNED_IN_KEY = 'tc.signed-in';
const EXPIRED_MESSAGE = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
/** Separación mínima entre verificaciones de la sesión al volver a la pestaña. */
const SESSION_CHECK_GAP_MS = 15_000;

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

/** Empleado que intenta usar la app desde una computadora o tableta (política de la empresa). */
export interface DeviceBlock {
  device: 'desktop' | 'tablet';
  /** Desde dónde debe continuar: teléfono (empleado) o tableta/teléfono (validador). */
  requires: 'phone' | 'touch';
  message: string;
}

export function deviceBlockFrom(error: Pick<ApiError, 'message' | 'code'> & { errors: ApiErrorItem[] }): DeviceBlock {
  const device = error.errors[0]?.details?.device === 'tablet' ? 'tablet' : 'desktop';
  return { device, requires: error.code === TOUCH_DEVICE_REQUIRED ? 'touch' : 'phone', message: error.message };
}

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** Mensaje mostrado en el login tras un cierre de sesión forzado (p. ej. expiración). */
  logoutReason: string | null;
  /** Dispositivo no permitido: la app muestra la pantalla "continúa desde tu teléfono". */
  deviceBlock: DeviceBlock | null;
  /** Sale de esa pantalla: cierra la sesión (si la hay) y vuelve al inicio de sesión. */
  dismissDeviceBlock: () => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  logout: (reason?: string) => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** EMPLOYEE en varias empresas: entra a una (o cambia de empresa sin cerrar sesión). */
  selectCompany: (companyId: number) => Promise<User>;
  /** Guarda preferencias en la BD; se aplican al instante y se revierten si el servidor falla. */
  updatePreferences: (changes: Partial<UserPreferences>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Sesión segura:
 * - Access token JWT (12 h) SOLO en memoria: un XSS no puede leerlo de storage.
 * - Refresh token en cookie HttpOnly (rotación con detección de reutilización en el backend).
 * - La sesión dura 12 h desde el inicio de sesión: al vencer, se cierra y el usuario vuelve al
 *   login automáticamente (aunque no esté haciendo peticiones o la pestaña estuviera oculta).
 * - Al recargar la página la sesión se restaura con la cookie (POST /auth/refresh) mientras
 *   siga vigente; un único refresh en curso compartido por todas las peticiones.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    preferenceStore.get(SIGNED_IN_KEY) ? 'restoring' : 'anonymous',
  );
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const [deviceBlock, setDeviceBlock] = useState<DeviceBlock | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const refreshing = useRef<Promise<boolean> | null>(null);

  const apply = useCallback((response: AuthTokenResponse) => {
    const next: Session = {
      token: response.access_token,
      user: response.user,
      sessionId: response.session_id,
      expiresAt: Date.now() + response.expires_in * 1000,
    };
    sessionRef.current = next; // disponible de inmediato para reintentar peticiones
    setSession(next);
    setStatus('authenticated');
    setLogoutReason(null);
    preferenceStore.set(SIGNED_IN_KEY, '1');
  }, []);

  const clear = useCallback((reason?: string) => {
    sessionRef.current = null;
    setSession(null);
    setStatus('anonymous');
    setLogoutReason(reason ?? null);
    preferenceStore.remove(SIGNED_IN_KEY);
  }, []);

  const refreshSession = useCallback((): Promise<boolean> => {
    refreshing.current ??= authService
      .refresh()
      .then((response) => {
        apply(response);
        return true;
      })
      .catch((error: unknown) => {
        // 401 = sesión revocada/expirada; errores de red no cierran la sesión.
        if (error instanceof ApiError && error.status === 401) clear(sessionRef.current ? EXPIRED_MESSAGE : undefined);
        return false;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [apply, clear]);

  // Se configura durante el primer render (no en un efecto): los efectos de los hijos corren
  // antes que los del provider y sus primeras peticiones saldrían sin estos hooks.
  const apiConfigured = useRef(false);
  if (!apiConfigured.current) {
    configureApiClient({
      getToken: () => sessionRef.current?.token ?? null,
      onUnauthorized: (message) => clear(message),
      onDeviceNotAllowed: (error) => setDeviceBlock(deviceBlockFrom(error)),
      refreshSession,
    });
    apiConfigured.current = true;
  }

  // Restaurar la sesión al cargar la app (cookie HttpOnly).
  useEffect(() => {
    if (status !== 'restoring') return;
    void refreshSession().then((ok) => {
      if (!ok) setStatus((current) => (current === 'restoring' ? 'anonymous' : current));
    });
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUser = useCallback((update: (user: User) => User) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { ...current, user: update(current.user) };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const updatePreferences = useCallback(
    async (changes: Partial<UserPreferences>) => {
      const previous = sessionRef.current?.user.preferences;
      setUser((user) => ({ ...user, preferences: { sidebar_collapsed: false, ...user.preferences, ...changes } }));
      try {
        const saved = await meService.updatePreferences(changes);
        setUser((user) => ({ ...user, preferences: saved }));
      } catch (error) {
        setUser((user) => ({ ...user, preferences: previous }));
        throw error;
      }
    },
    [setUser],
  );

  const selectCompany = useCallback(
    async (companyId: number) => {
      const user = await authService.selectCompany(companyId);
      setUser(() => user);
      return user;
    },
    [setUser],
  );

  const refreshUser = useCallback(async () => {
    if (!sessionRef.current) return;
    const user = await authService.me();
    setUser(() => user);
  }, [setUser]);

  // Sesión vencida → login. Temporizador al vencimiento y, como los navegadores pausan los
  // temporizadores de pestañas ocultas, también se revisa al volver a la pestaña. Al volver,
  // además se confirma con el servidor que siga vigente: con una sola sesión por usuario, si
  // inició sesión en otro dispositivo esta se cerró (401 SESSION_REPLACED → login con aviso).
  const lastServerCheck = useRef(0);
  useEffect(() => {
    if (!session) return;
    const expireIfDue = () => {
      if (Date.now() < session.expiresAt) return false;
      clear(EXPIRED_MESSAGE);
      return true;
    };
    const timer = window.setTimeout(expireIfDue, Math.max(0, Math.min(session.expiresAt - Date.now(), 2 ** 31 - 1)));
    const onVisible = () => {
      if (document.hidden || expireIfDue() || Date.now() - lastServerCheck.current < SESSION_CHECK_GAP_MS) return;
      lastServerCheck.current = Date.now();
      // Actualiza el usuario (p. ej. la empresa pidió verificar de nuevo la identidad) y un 401
      // cierra la sesión vía apiClient.
      void refreshUser().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [session, clear, refreshUser]);

  const login = useCallback(
    async (email: string, password: string, remember = false) => {
      const response = await authService.login(email, password, remember);
      apply(response);
      return response.user;
    },
    [apply],
  );

  const logout = useCallback(
    async (reason?: string) => {
      try {
        await authService.logout(); // revoca la sesión en el servidor y borra la cookie
      } catch {
        /* sin red: la sesión local se cierra igual */
      }
      clear(reason);
    },
    [clear],
  );

  const dismissDeviceBlock = useCallback(async () => {
    if (sessionRef.current) await logout();
    setDeviceBlock(null);
  }, [logout]);

  const logoutEverywhere = useCallback(async () => {
    await authService.logoutAll();
    // El usuario ya lo confirmó: aquí no se avisa. Los demás dispositivos sí reciben el motivo.
    clear();
  }, [clear]);


  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      status,
      isAuthenticated: status === 'authenticated' && session !== null,
      logoutReason,
      deviceBlock,
      dismissDeviceBlock,
      login,
      logout,
      logoutEverywhere,
      refreshUser,
      selectCompany,
      updatePreferences,
    }),
    [session, status, logoutReason, deviceBlock, dismissDeviceBlock, login, logout, logoutEverywhere, refreshUser, selectCompany, updatePreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
