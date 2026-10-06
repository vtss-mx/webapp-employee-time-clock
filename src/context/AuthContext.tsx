import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t, type LazyText } from '../i18n';
import { ApiError, configureApiClient, retryDelay } from '../services/apiClient';
import { authService, type LoginProofs } from '../services/authService';
import { meService } from '../services/meService';
import type { AuthTokenResponse, Session, User, UserPreferences } from '../types';
import { clearAvatarCache } from '../utils/avatarCache';
import { deviceProof } from '../utils/deviceKey';
import { setBusinessTimeZone } from '../utils/format';
import { currentLocation } from '../utils/geolocation';
import { describeDevice } from '../utils/userAgent';
import { sleep, whenOnline } from '../utils/waits';

/**
 * Inicio de sesión con las pruebas que el backend pida a un validador, en el orden en que las pide:
 * - DEVICE_PROOF_REQUIRED: el dispositivo firma el reto con su llave (no exportable).
 * - LOCATION_REQUIRED: la ubicación del dispositivo (aviso nativo del navegador).
 * Cada prueba se pide una sola vez; cualquier otro error (incluido "dispositivo por autorizar") sube.
 */
async function loginWithProofs(email: string, password: string, remember: boolean, onLocating?: () => void): Promise<AuthTokenResponse> {
  const proofs: LoginProofs = {};
  for (;;) {
    try {
      return await authService.login(email, password, remember, proofs);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.code === 'DEVICE_PROOF_REQUIRED' && !proofs.device) {
        const nonce = err.details?.nonce;
        proofs.device = await deviceProof(typeof nonce === 'string' ? nonce : '', describeDevice(navigator.userAgent).label);
      } else if (err.code === 'LOCATION_REQUIRED' && !proofs.location) {
        onLocating?.();
        proofs.location = await currentLocation();
      } else {
        throw err;
      }
    }
  }
}

/**
 * Motivo del cierre cuando vence la sesión. Se guarda la función (no el texto): el aviso del inicio de
 * sesión lo traduce al dibujarse y sigue al idioma activo.
 */
const expiredReason: LazyText = () => t('auth.session.expired');
/** Separación mínima entre verificaciones de la sesión al volver a la pestaña. */
const SESSION_CHECK_GAP_MS = 15_000;
/** Reintentos al restaurar la sesión si el servidor no responde (espera creciente: ~12 s en total). */
const RESTORE_RETRIES = 5;

/** Falla pasajera (sin red, tiempo agotado, servidor caído o reiniciando): la sesión puede seguir viva. */
function isTransientFailure(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.isTransient || error.status >= 500);
}

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

/** Validador que intenta operar desde una computadora (su empresa exige tableta o teléfono). */
export interface DeviceBlock {
  message: string;
}

export function deviceBlockFrom(error: Pick<ApiError, 'message'>): DeviceBlock {
  return { message: error.message };
}

/**
 * Empresa suspendida en la plataforma (cobranza): nadie de ella entra ni opera. Lleva el mensaje del
 * servidor; la app lo muestra a pantalla completa (`SuspensionGate`).
 */
export type CompanySuspension = DeviceBlock;

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /**
   * Mensaje mostrado en el login tras un cierre de sesión forzado: el del servidor (ya traducido) o
   * uno de la app como función que se traduce al dibujarse (p. ej. expiración). Se muestra con
   * `resolveLazy`.
   */
  logoutReason: LazyText | null;
  /** Validador en una computadora: la app muestra "continúa desde una tableta o un teléfono". */
  deviceBlock: DeviceBlock | null;
  /** Sale de esa pantalla: cierra la sesión (si la hay) y vuelve al inicio de sesión. */
  dismissDeviceBlock: () => Promise<void>;
  /** Su empresa está suspendida (401 o 403 COMPANY_SUSPENDED): "Tu empresa está suspendida". */
  suspension: CompanySuspension | null;
  /** Sale de esa pantalla: cierra la sesión local (de mejor esfuerzo en el servidor) sin otro aviso. */
  dismissSuspension: () => Promise<void>;
  /** `onLocating`: el backend pidió la ubicación del dispositivo y se está obteniendo. */
  login: (email: string, password: string, remember?: boolean, options?: { onLocating?: () => void }) => Promise<User>;
  logout: (reason?: LazyText) => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** EMPLOYEE en varias empresas: entra a una (o cambia de empresa sin cerrar sesión). */
  selectCompany: (companyId: number) => Promise<User>;
  /** Guarda preferencias en la BD; se aplican al instante y se revierten si el servidor falla. */
  updatePreferences: (changes: Partial<UserPreferences>) => Promise<void>;
  /** Su foto de perfil cambió (ya guardada en el servidor): la ruta nueva o null (sin foto). */
  updateAvatar: (avatar: string | null) => void;
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
  // Siempre se empieza preguntando al backend si hay sesión (la cookie HttpOnly es la única fuente: el
  // navegador no guarda nada propio para saberlo).
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [logoutReason, setLogoutReason] = useState<LazyText | null>(null);
  const [deviceBlock, setDeviceBlock] = useState<DeviceBlock | null>(null);
  const [suspension, setSuspension] = useState<CompanySuspension | null>(null);
  const sessionRef = useRef<Session | null>(null);
  /** Renovación en curso (compartida); se resuelve con el error, o null si se renovó. */
  const refreshing = useRef<Promise<unknown> | null>(null);

  const apply = useCallback((response: AuthTokenResponse) => {
    const next: Session = {
      token: response.access_token,
      user: response.user,
      sessionId: response.session_id,
      expiresAt: Date.now() + response.expires_in * 1000,
    };
    sessionRef.current = next; // disponible de inmediato para reintentar peticiones
    setBusinessTimeZone(response.user.timezone); // antes de dibujar cualquier fecha
    setSession(next);
    setStatus('authenticated');
    setLogoutReason(null);
  }, []);

  const clear = useCallback((reason?: LazyText) => {
    sessionRef.current = null;
    setSession(null);
    setStatus('anonymous');
    clearAvatarCache(); // nada de la persona queda en la página (las fotos descargadas viven en memoria)
    // Una función se guarda tal cual (no se llama: `setState` la tomaría como actualizador).
    setLogoutReason(() => reason ?? null);
  }, []);

  /** Renueva el access token con la cookie (un único refresh en curso). Se resuelve con el error, o null si se renovó. */
  const renew = useCallback((): Promise<unknown> => {
    refreshing.current ??= authService
      .refresh()
      .then((response) => {
        apply(response);
        return null;
      })
      .catch((error: unknown) => {
        // 401 = sesión revocada/expirada; errores de red no cierran la sesión.
        if (error instanceof ApiError && error.status === 401) clear(sessionRef.current ? expiredReason : undefined);
        // Un rechazo sin motivo no debe tomarse como éxito (null). Nunca se muestra: solo se compara.
        return error ?? new Error('SESSION_RENEW_FAILED');
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [apply, clear]);

  const refreshSession = useCallback(async () => (await renew()) === null, [renew]);

  // Se configura durante el primer render (no en un efecto): los efectos de los hijos corren
  // antes que los del provider y sus primeras peticiones saldrían sin estos hooks.
  const apiConfigured = useRef(false);
  if (!apiConfigured.current) {
    configureApiClient({
      getToken: () => sessionRef.current?.token ?? null,
      onUnauthorized: (message) => clear(message),
      onDeviceNotAllowed: (error) => setDeviceBlock(deviceBlockFrom(error)),
      onCompanySuspended: (error) => setSuspension(deviceBlockFrom(error)),
      refreshSession,
    });
    apiConfigured.current = true;
  }

  // Restaurar la sesión al cargar la app (cookie HttpOnly). Solo un rechazo del servidor (401: vencida
  // o revocada) o un error que no se arregla reintentando lleva al login; una falla pasajera (sin red,
  // servidor reiniciando) se reintenta con espera creciente —sin red, al recuperar la conexión— para
  // no pedir de nuevo la contraseña con la sesión aún vigente.
  useEffect(() => {
    // Solo al montar, y la app siempre empieza en 'restoring' (pregunta al backend si hay sesión).
    let active = true;
    const restore = async () => {
      // Sin sesión no hay nada que renovar (ni un 401 que registrar); si no se pudo preguntar, se intenta.
      const signedIn = await authService.sessionStatus().then(
        (probe) => probe.signed_in,
        () => true,
      );
      for (let attempt = 0; signedIn; attempt++) {
        const error = await renew();
        if (error === null || !active) return;
        if (!isTransientFailure(error) || attempt >= RESTORE_RETRIES) break;
        await sleep(retryDelay(attempt, error.retryAfterMs));
        await whenOnline();
        if (!active) return;
      }
      setStatus((current) => (current === 'restoring' ? 'anonymous' : current));
    };
    void restore();
    return () => {
      active = false;
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUser = useCallback((update: (user: User) => User) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { ...current, user: update(current.user) };
    setBusinessTimeZone(next.user.timezone);
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

  const updateAvatar = useCallback((avatar: string | null) => setUser((user) => ({ ...user, avatar })), [setUser]);

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
      clear(expiredReason);
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
    async (email: string, password: string, remember = false, { onLocating }: { onLocating?: () => void } = {}) => {
      const response = await loginWithProofs(email, password, remember, onLocating);
      apply(response);
      return response.user;
    },
    [apply],
  );

  const logout = useCallback(
    async (reason?: LazyText) => {
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

  // La sesión se cierra (o ya la cerró el 401) sin motivo: la pantalla de suspensión ya lo explicó y
  // el inicio de sesión no repite el aviso.
  const dismissSuspension = useCallback(async () => {
    if (sessionRef.current) await logout();
    else clear();
    setSuspension(null);
  }, [logout, clear]);

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
      suspension,
      dismissSuspension,
      login,
      logout,
      logoutEverywhere,
      refreshUser,
      selectCompany,
      updatePreferences,
      updateAvatar,
    }),
    [session, status, logoutReason, deviceBlock, dismissDeviceBlock, suspension, dismissSuspension, login, logout, logoutEverywhere, refreshUser, selectCompany, updatePreferences, updateAvatar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
