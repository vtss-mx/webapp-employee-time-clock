import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, mockFetch } from '../../test/http';
import { configureApiClient } from '../apiClient';
import { checkAvailability } from '../availabilityService';
import { realtimeUrl, ValidationSocket, validationSocket } from './validationSocket';

type Handler = (message: Record<string, unknown>, socket: FakeSocket) => void;

/** WebSocket simulado: responde como el servidor real (contrato único, traceId = id). */
class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: Array<Record<string, unknown>> = [];
  constructor(public url: string, private handler: Handler) {
    queueMicrotask(() => this.onopen?.());
  }
  send(data: string) {
    const message = JSON.parse(data) as Record<string, unknown>;
    this.sent.push(message);
    queueMicrotask(() => this.handler(message, this));
  }
  reply(statusCode: number, code: string, data: unknown, traceId?: unknown) {
    const body = { success: statusCode < 300, statusCode, code, message: code, data, errors: [], traceId, timestamp: 'x' };
    this.onmessage?.({ data: JSON.stringify(body) } as MessageEvent<string>);
  }
  close(code = 1000) {
    this.onclose?.({ code } as CloseEvent);
  }
}

const availability = (code: string, available: boolean) => ({
  field: 'employee_number', value: 'EMP-1', normalized: 'EMP-1', valid: code !== 'INVALID_FORMAT', available, code, message: code,
});

const server: Handler = (message, socket) => {
  if (message.type === 'auth') return socket.reply(200, 'WS_AUTHENTICATED', { fields: ['employee_number', 'email'] });
  const taken = message.value === 'EMP-1';
  socket.reply(200, taken ? 'TAKEN' : 'AVAILABLE', availability(taken ? 'TAKEN' : 'AVAILABLE', !taken), message.id);
};

beforeEach(() => configureApiClient({ getToken: () => 'token-1', onUnauthorized: vi.fn(), refreshSession: () => Promise.resolve(true) }));
afterEach(() => vi.useRealTimers());

describe('ValidationSocket', () => {
  it('construye la URL ws/wss a partir de la API', () => {
    expect(realtimeUrl()).toBe('ws://localhost:3000/api/ws/validation');
  });

  it('se autentica con el primer mensaje y empareja respuestas por id', async () => {
    let socket: FakeSocket | undefined;
    const channel = new ValidationSocket((url) => (socket = new FakeSocket(url, server)) as unknown as WebSocket);
    const [taken, free] = await Promise.all([
      channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-1' }),
      channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' }),
    ]);
    expect(socket?.sent[0]).toEqual({ type: 'auth', token: 'token-1' }); // el token no va en la URL
    expect(socket?.url).not.toContain('token');
    expect(taken.code).toBe('TAKEN');
    expect(free.code).toBe('AVAILABLE');
    expect(socket?.sent.filter((m) => m.type === 'validate').every((m) => typeof m.id === 'string')).toBe(true);
    channel.close();
  });

  it('si el navegador no deja crear el canal, esa consulta falla y la siguiente lo intenta de nuevo', async () => {
    let attempts = 0;
    const channel = new ValidationSocket((url) => {
      attempts += 1;
      if (attempts === 1) throw new DOMException('URL bloqueada por el proxy', 'SyntaxError');
      return new FakeSocket(url, server) as unknown as WebSocket;
    });
    await expect(channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-1' })).rejects.toThrow('No se pudo abrir el canal');
    expect(channel.available).toBe(true); // una sola falla no lo degrada
    const answer = await channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' });
    expect(answer.code).toBe('AVAILABLE');
    expect(attempts).toBe(2);
    channel.close();
  });

  it('rechaza si el servidor no responde a tiempo y se degrada tras fallas repetidas', async () => {
    vi.useFakeTimers();
    const silent: Handler = (message, socket) => {
      if (message.type === 'auth') socket.reply(200, 'WS_AUTHENTICATED', {});
    };
    const channel = new ValidationSocket((url) => new FakeSocket(url, silent) as unknown as WebSocket);
    for (let i = 0; i < 2; i++) {
      const pending = channel.request({ type: 'validate', field: 'email', value: 'a@b.com' });
      const assertion = expect(pending).rejects.toThrow('Tiempo de espera agotado');
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    }
    expect(channel.available).toBe(false);
    await expect(channel.request({ type: 'ping' })).rejects.toThrow('no disponible');
  });

  it('una consulta sin respuesta cierra la conexión (medio abierta) y la siguiente abre otra', async () => {
    vi.useFakeTimers();
    let answer = false;
    const sockets: FakeSocket[] = [];
    const flaky: Handler = (message, socket) => {
      if (message.type === 'auth') return socket.reply(200, 'WS_AUTHENTICATED', {});
      if (answer) server(message, socket);
    };
    const channel = new ValidationSocket((url) => {
      const socket = new FakeSocket(url, flaky);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    });
    const first = channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' });
    const assertion = expect(first).rejects.toThrow('Tiempo de espera agotado');
    const closed = vi.spyOn(sockets[0], 'close');
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(closed).toHaveBeenCalledWith(1000);
    answer = true;
    const second = await channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' });
    expect(second.code).toBe('AVAILABLE');
    expect(sockets).toHaveLength(2); // conexión nueva, no la que dejó de responder
    // El aviso tardío de cierre de la conexión descartada no toca la nueva ni cuenta como falla.
    sockets[0].onclose?.({ code: 1006 } as CloseEvent);
    expect(channel.available).toBe(true);
    const third = await channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-1' });
    expect(third.code).toBe('TAKEN');
    expect(sockets).toHaveLength(2);
    channel.close();
  });

  it('un cierre por sesión inválida rechaza y pide renovar el token', async () => {
    const refresh = vi.fn(() => Promise.resolve(true));
    configureApiClient({ getToken: () => 'vencido', onUnauthorized: vi.fn(), refreshSession: refresh });
    const reject: Handler = (_message, socket) => {
      socket.reply(401, 'TOKEN_EXPIRED', null);
      socket.close(4401);
    };
    const channel = new ValidationSocket((url) => new FakeSocket(url, reject) as unknown as WebSocket);
    await expect(channel.request({ type: 'validate', field: 'email', value: 'x' })).rejects.toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('sin sesión no abre el canal', async () => {
    configureApiClient({ getToken: () => null, onUnauthorized: vi.fn(), refreshSession: () => Promise.resolve(false) });
    const channel = new ValidationSocket((url) => new FakeSocket(url, server) as unknown as WebSocket);
    await expect(channel.request({ type: 'ping' })).rejects.toThrow('Sin sesión');
  });
});

/** Canal con su propio servidor simulado (la fábrica del WebSocket). */
const channelWith = (handler: Handler, sockets: FakeSocket[] = []) =>
  new ValidationSocket((url) => {
    const socket = new FakeSocket(url, handler);
    sockets.push(socket);
    return socket as unknown as WebSocket;
  });

/** Servidor que autentica y cierra la conexión con `code` en cuanto recibe una consulta. */
const closesWith =
  (code: number): Handler =>
  (message, socket) =>
    message.type === 'auth' ? socket.reply(200, 'WS_AUTHENTICATED', {}) : socket.close(code);

describe('ValidationSocket: fallas del canal', () => {
  it('con API en https el canal usa wss', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.ejemplo.mx/api');
    vi.resetModules();
    const fresh = await import('./validationSocket');
    expect(fresh.realtimeUrl()).toBe('wss://api.ejemplo.mx/api/ws/validation');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('si el servidor no confirma la autenticación a tiempo, rechaza y cierra la conexión', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const channel = channelWith(() => undefined, sockets);
    const pending = channel.request({ type: 'validate', field: 'email', value: 'a@b.com' });
    const assertion = expect(pending).rejects.toThrow('No se pudo abrir el canal');
    await vi.advanceTimersByTimeAsync(0);
    const closed = vi.spyOn(sockets[0], 'close');
    await vi.advanceTimersByTimeAsync(4_000);
    await assertion;
    expect(closed).toHaveBeenCalledOnce();
  });

  it('ignora mensajes ilegibles, sin código de estado, de otra consulta o errores del socket', async () => {
    const noisy: Handler = (message, socket) => {
      if (message.type === 'auth') return socket.reply(200, 'WS_AUTHENTICATED', {});
      socket.onerror?.(); // el cierre (no el error) informa la causa
      socket.onmessage?.({ data: '{no es json' } as MessageEvent<string>);
      socket.onmessage?.({ data: '"ping"' } as MessageEvent<string>);
      socket.onmessage?.({ data: JSON.stringify({ hola: 1 }) } as MessageEvent<string>);
      socket.reply(200, 'AVAILABLE', availability('AVAILABLE', true), 'otra-consulta');
      server(message, socket);
    };
    const channel = channelWith(noisy);
    const answer = await channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' });
    expect(answer.code).toBe('AVAILABLE');
    channel.close();
  });

  it('el servidor corta la conexión: la consulta en curso se rechaza y, tras dos cortes, el canal se pausa', async () => {
    const channel = channelWith(closesWith(1006));
    await expect(channel.request({ type: 'validate', field: 'email', value: 'x' })).rejects.toThrow('Canal cerrado (1006)');
    expect(channel.available).toBe(true); // una falla aislada no pausa el canal
    await expect(channel.request({ type: 'validate', field: 'email', value: 'x' })).rejects.toThrow('Canal cerrado (1006)');
    expect(channel.available).toBe(false);
  });

  it('un cierre normal (1000) del servidor no cuenta como falla', async () => {
    const channel = channelWith(closesWith(1000));
    for (let i = 0; i < 3; i++) {
      await expect(channel.request({ type: 'validate', field: 'email', value: 'x' })).rejects.toThrow('Canal cerrado (1000)');
    }
    expect(channel.available).toBe(true);
  });

  it('sesión rechazada de nuevo tras renovar: ya no renueva otra vez y cuenta como falla', async () => {
    const refresh = vi.fn(() => Promise.resolve(true));
    configureApiClient({ getToken: () => 'vencido', onUnauthorized: vi.fn(), refreshSession: refresh });
    const channel = channelWith((_message, socket) => socket.close(4401));
    for (let i = 0; i < 3; i++) {
      await expect(channel.request({ type: 'validate', field: 'email', value: 'x' })).rejects.toThrow('Canal cerrado (4401)');
    }
    expect(refresh).toHaveBeenCalledOnce();
    expect(channel.available).toBe(false);
  });

  it('se cierra solo tras un periodo sin consultas (no ocupa conexiones del servidor)', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const channel = channelWith(server, sockets);
    await channel.request({ type: 'validate', field: 'employee_number', value: 'EMP-2' });
    const closed = vi.spyOn(sockets[0], 'close');
    await vi.advanceTimersByTimeAsync(59_000);
    expect(closed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(closed).toHaveBeenCalledWith(1000);
  });
});

describe('checkAvailability por WebSocket', () => {
  const socketWith = (handler: Handler) =>
    class extends FakeSocket {
      constructor(url: string) {
        super(url, handler);
      }
    };
  afterEach(() => {
    validationSocket.close();
    vi.unstubAllGlobals();
  });

  it('responde por el canal en vivo cuando está disponible', async () => {
    vi.stubGlobal('WebSocket', socketWith(server));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(checkAvailability('employee_number', 'EMP-1', 3, 'ana@empresa.com')).resolves.toMatchObject({ code: 'TAKEN', available: false, via: 'websocket' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('una respuesta del canal con forma inesperada usa el respaldo HTTP', async () => {
    const odd: Handler = (message, socket) =>
      message.type === 'auth' ? socket.reply(200, 'WS_AUTHENTICATED', {}) : socket.reply(200, 'OK', { inesperado: true }, message.id);
    vi.stubGlobal('WebSocket', socketWith(odd));
    const { calls } = mockFetch(apiOk(availability('AVAILABLE', true)));
    await expect(checkAvailability('employee_number', 'EMP-9')).resolves.toMatchObject({ code: 'AVAILABLE', via: 'http' });
    expect(calls).toHaveLength(1);
  });
});

describe('checkAvailability', () => {
  it('respaldo HTTP: un solo intento con tiempo límite corto (no deja el formulario "verificando")', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', undefined);
    const fetch = vi.fn((_: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    vi.stubGlobal('fetch', fetch);
    const result = checkAvailability('email', 'a@b.com');
    const assertion = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(fetch).toHaveBeenCalledOnce(); // sin los reintentos de las lecturas normales
  });

  it('usa el respaldo HTTP si el WebSocket falla', async () => {
    vi.stubGlobal('WebSocket', class {
      constructor() {
        throw new Error('bloqueado por el proxy');
      }
    });
    const { calls } = mockFetch(apiOk(availability('AVAILABLE', true)));
    const result = await checkAvailability('employee_number', 'EMP-9', 7);
    expect(result).toMatchObject({ code: 'AVAILABLE', via: 'http' });
    expect(calls[0].url).toBe('/api/validation?field=employee_number&value=EMP-9&exclude_id=7');
  });
});
