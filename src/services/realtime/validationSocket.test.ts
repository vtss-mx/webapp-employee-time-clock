import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, mockFetch } from '../../test/http';
import { configureApiClient } from '../apiClient';
import { checkAvailability } from '../availabilityService';
import { realtimeUrl, ValidationSocket } from './validationSocket';

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

describe('checkAvailability', () => {
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
