import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { ApiError } from '../services/apiClient';
import { errorDetail } from '../services/http/requestSigning';
import { kioskService } from '../services/kioskService';
import type { KioskCode, KioskSession } from '../types';
import { config } from '../utils/config';
import { deviceStore } from '../utils/deviceStore';
import { isRecord } from '../utils/guards';
import { sleep, whenOnline } from '../utils/waits';
import { useFeedback } from './useFeedback';

/** Lo único que la tableta guarda (IndexedDB, `deviceStore`): qué kiosco es. La llave vive aparte (`deviceKey`). */
const STORE_KEY = 'kiosk';
/** Primera espera tras una falla; luego se duplica hasta `config.kioskRetryMaxMs`. */
const RETRY_BASE_MS = 2_000;
/** Nunca se piden códigos más seguido que esto (un `expires_in` de 0 no hace un ciclo sin pausa). */
const MIN_ROUND_MS = 1_000;

/**
 * Lo que muestra la tableta:
 * - loading: leyendo qué kiosco es;
 * - pairing: sin vincular (o con un `#pair=` en la dirección): el formulario con el código de vinculación;
 * - code: el código vigente y cuándo cambia (`deadline`, reloj de la tableta);
 * - offline: el último código venció y el siguiente no llegó (sin red o el servidor falla): se reintenta con espera
 *   creciente;
 * - disabled: el sitio desactivó su código (o no está activo): aviso tranquilo con el mensaje del servidor.
 */
export type KioskView =
  | { kind: 'loading' }
  | { kind: 'pairing'; code: string }
  | { kind: 'code'; code: KioskCode; deadline: number }
  | { kind: 'offline' }
  | { kind: 'disabled'; error: ApiError };

/** El sitio y la empresa de la tableta (para las pantallas sin código). */
export interface KioskPlace {
  site: string;
  company: string;
}

interface Session {
  id: number;
  /** Reto para firmar el primer código (el de la vinculación); al abrir la app no hay: el servidor lo pide. */
  nonce: string | null;
}

/** Cómo informa el ciclo a la pantalla. */
interface KioskUi {
  show: (code: KioskCode, deadline: number) => void;
  offline: () => void;
  disabled: (error: ApiError) => void;
  unpaired: (error: ApiError) => void;
}

/** El código de vinculación del fragmento `#pair=…` (nunca llega a un servidor); null si no hay. */
export function linkPairingCode(): string | null {
  const match = /(?:^#|&)pair=([^&]+)/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Se resuelve con la pestaña visible (o al cancelarse): no se piden códigos que nadie ve. */
function whenVisible(signal: AbortSignal): Promise<void> {
  if (document.visibilityState !== 'hidden') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (document.visibilityState === 'hidden' && !signal.aborted) return;
      document.removeEventListener('visibilitychange', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    document.addEventListener('visibilitychange', done);
    signal.addEventListener('abort', done);
  });
}

const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : '');

/**
 * El ciclo de la tableta: pide el código, lo muestra hasta que cambia y justo entonces pide el siguiente (con el reto
 * que llegó con el anterior). Con la pestaña oculta se detiene. Sin red (o con el servidor fallando) el último código
 * se ve hasta que vence, que es cuando se pide el siguiente; si no llega, "Sin conexión" (nunca un código vencido) y se
 * reintenta cada vez con más calma, o al instante al volver la red. Un sitio sin código se vuelve a preguntar con
 * calma; un kiosco eliminado o sin vincular termina el ciclo (hay que vincularlo de nuevo).
 */
async function runKiosk({ id, nonce: first }: Session, signal: AbortSignal, ui: KioskUi): Promise<void> {
  let nonce = first;
  let failures = 0;
  while (!signal.aborted) {
    await whenVisible(signal);
    if (signal.aborted) return;
    try {
      const code = await kioskService.code(id, nonce, signal);
      nonce = code.device_nonce;
      failures = 0;
      ui.show(code, Date.now() + code.expires_in * 1000);
      await sleep(Math.max(MIN_ROUND_MS, code.expires_in * 1000), signal);
    } catch (error) {
      if (signal.aborted) return;
      nonce = errorDetail(error, 'nonce') ?? nonce;
      if (errorCode(error) === 'KIOSK_NOT_FOUND') return ui.unpaired(error as ApiError);
      if (errorCode(error) === 'SITE_CODE_DISABLED') {
        ui.disabled(error as ApiError);
        await sleep(config.kioskDisabledRetryMs, signal);
        continue;
      }
      failures += 1;
      ui.offline();
      const wait = Math.min(config.kioskRetryMaxMs, RETRY_BASE_MS * 2 ** (failures - 1));
      await Promise.race([sleep(wait, signal), ...(navigator.onLine ? [] : [whenOnline()])]);
    }
  }
}

/**
 * Pantalla del kiosco de un sitio (`/kiosk`, pública): recuerda en el dispositivo qué kiosco es, lo vincula con el
 * código de un solo uso (`pair`, del formulario o del `#pair=` de la dirección, que se borra al leerse) y mantiene el
 * código del sitio en pantalla. Un kiosco eliminado o sin vincular se olvida y vuelve al formulario con su aviso.
 */
export function useKioskDisplay() {
  const feedback = useFeedback();
  // El aviso de un kiosco desvinculado se pide con la versión vigente sin reiniciar el ciclo.
  const feedbackRef = useRef(feedback);
  useLayoutEffect(() => {
    feedbackRef.current = feedback;
  });
  // El fragmento se lee al dibujarse (sin efectos: StrictMode puede repetirlo) y se borra en un efecto.
  const [linkCode] = useState(linkPairingCode);
  const [view, setView] = useState<KioskView>({ kind: 'loading' });
  const [session, setSession] = useState<Session | null>(null);
  const [place, setPlace] = useState<KioskPlace | null>(null);

  useEffect(() => {
    if (linkCode) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    let active = true;
    void deviceStore.get(STORE_KEY).then((saved) => {
      if (!active) return;
      const id = isRecord(saved) && typeof saved.kiosk_id === 'number' ? saved.kiosk_id : null;
      if (linkCode || id === null) setView({ kind: 'pairing', code: linkCode ?? '' });
      else setSession({ id, nonce: null });
    });
    return () => {
      active = false;
    };
  }, [linkCode]);

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    void runKiosk(session, controller.signal, {
      show: (code, deadline) => {
        setPlace({ site: code.site_name, company: code.company_name });
        setView({ kind: 'code', code, deadline });
      },
      offline: () => setView({ kind: 'offline' }),
      disabled: (error) => setView({ kind: 'disabled', error }),
      unpaired: (error) => {
        void deviceStore.set(STORE_KEY, null);
        setSession(null);
        setView({ kind: 'pairing', code: '' });
        void feedbackRef.current.fromError(error, { title: () => t('kiosk.display.unpairedTitle') });
      },
    });
    return () => controller.abort();
  }, [session]);

  /** Vincula esta tableta y empieza a mostrar el código (el reto de la vinculación firma el primero). */
  const pair = useCallback(async (code: string) => {
    const paired: KioskSession = await kioskService.pair(code);
    await deviceStore.set(STORE_KEY, { kiosk_id: paired.kiosk_id });
    setPlace({ site: paired.site_name, company: paired.company_name });
    setView({ kind: 'loading' });
    setSession({ id: paired.kiosk_id, nonce: paired.device_nonce });
  }, []);

  return { view, place, pair };
}
