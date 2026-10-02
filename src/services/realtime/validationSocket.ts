import { config } from '../../utils/config';
import { ApiError, currentAccessToken, newTraceId, normalizeResponse, renewAccessToken, type ApiEnvelope } from '../apiClient';

/**
 * Canal WebSocket de validación en tiempo real (/api/ws/validation).
 *
 * - Se conecta bajo demanda y se autentica con el primer mensaje (el token no va en la URL).
 * - Cada consulta lleva un `id` que el servidor devuelve como `traceId`: así se empareja cada
 *   respuesta con su pregunta aunque lleguen en otro orden.
 * - Tiempo límite por consulta; ante cualquier falla la promesa se rechaza y el llamador usa el
 *   respaldo HTTP. Tras fallas repetidas se pausa el canal un minuto (sin reconexiones en bucle).
 * - Se cierra solo tras un periodo sin uso para no ocupar conexiones del servidor.
 */
type Pending = { resolve: (envelope: ApiEnvelope) => void; reject: (error: unknown) => void; timer: number };

const AUTH_CLOSE_CODES = new Set([4401, 4403, 4408]);
const DEGRADED_MS = 60_000;

export function realtimeUrl(path = '/ws/validation'): string {
  const url = new URL(`${config.apiUrl}${path}`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export class ValidationSocket {
  private socket: WebSocket | null = null;
  private ready: Promise<void> | null = null;
  private readonly pending = new Map<string, Pending>();
  private idleTimer: number | undefined;
  private failures = 0;
  private degradedUntil = 0;
  private triedRefresh = false;

  constructor(private readonly factory: (url: string) => WebSocket = (url) => new WebSocket(url)) {}

  get available(): boolean {
    return config.realtimeEnabled && typeof WebSocket !== 'undefined' && Date.now() >= this.degradedUntil;
  }

  async request(message: Record<string, unknown>): Promise<ApiEnvelope> {
    if (!this.available) throw new Error('Canal en tiempo real no disponible');
    await this.connect();
    const id = newTraceId();
    return new Promise<ApiEnvelope>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.fail();
        reject(new Error('Tiempo de espera agotado'));
      }, config.realtimeTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket?.send(JSON.stringify({ ...message, id }));
      this.touch();
    });
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    this.socket?.close(1000);
    this.reset(new Error('Canal cerrado'));
  }

  private connect(): Promise<void> {
    if (this.ready) return this.ready;
    const token = currentAccessToken();
    if (!token) return Promise.reject(new Error('Sin sesión'));
    this.ready = new Promise<void>((resolve, reject) => {
      const socket = this.factory(realtimeUrl());
      this.socket = socket;
      const timer = window.setTimeout(() => {
        reject(new Error('No se pudo abrir el canal'));
        socket.close();
      }, config.realtimeTimeoutMs);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
      socket.onmessage = (event: MessageEvent<string>) => {
        const envelope = this.parse(event.data);
        if (!envelope) return;
        if (envelope.code === 'WS_AUTHENTICATED') {
          window.clearTimeout(timer);
          this.failures = 0;
          this.triedRefresh = false;
          resolve();
          return;
        }
        const waiting = envelope.traceId ? this.pending.get(envelope.traceId) : undefined;
        if (waiting) {
          window.clearTimeout(waiting.timer);
          this.pending.delete(envelope.traceId ?? '');
          waiting.resolve(envelope);
        } else if (!envelope.success && envelope.statusCode === 401) {
          window.clearTimeout(timer);
          reject(new ApiError(envelope));
        }
      };
      socket.onerror = () => undefined; // el cierre (onclose) informa la causa
      socket.onclose = (event: CloseEvent) => {
        window.clearTimeout(timer);
        reject(new Error(`Canal cerrado (${event.code})`));
        // Token vencido o revocado: se intenta renovar una vez; la siguiente consulta reconecta.
        if (AUTH_CLOSE_CODES.has(event.code) && !this.triedRefresh) {
          this.triedRefresh = true;
          void renewAccessToken();
        } else if (event.code !== 1000) {
          this.fail();
        }
        this.reset(new Error(`Canal cerrado (${event.code})`));
      };
    });
    return this.ready;
  }

  private parse(data: string): ApiEnvelope | null {
    try {
      const body: unknown = JSON.parse(data);
      const status = typeof body === 'object' && body !== null && 'statusCode' in body ? Number(body.statusCode) : 0;
      return normalizeResponse(status, body, { isJson: true });
    } catch {
      return null;
    }
  }

  private touch(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.close(), config.realtimeIdleMs);
  }

  private fail(): void {
    this.failures += 1;
    if (this.failures >= 2) this.degradedUntil = Date.now() + DEGRADED_MS;
  }

  private reset(reason: Error): void {
    this.socket = null;
    this.ready = null;
    for (const [id, waiting] of this.pending) {
      window.clearTimeout(waiting.timer);
      waiting.reject(reason);
      this.pending.delete(id);
    }
  }
}

export const validationSocket = new ValidationSocket();
