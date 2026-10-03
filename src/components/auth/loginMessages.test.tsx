import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { DeviceKeyError } from '../../utils/deviceKey';
import { loginRuleMessage } from './loginMessages';

const apiError = (code: string, message = 'texto del servidor') => new ApiError({ statusCode: 403, code, message });

describe('avisos de las reglas del inicio de sesión', () => {
  it('dispositivo: por autorizar (con pasos), rechazado, revocado, firma inválida y sin llave', () => {
    expect(loginRuleMessage(apiError('DEVICE_PENDING_APPROVAL'))).toMatchObject({ variant: 'info', title: 'Dispositivo por autorizar', text: 'texto del servidor' });
    expect(loginRuleMessage(apiError('DEVICE_PENDING_APPROVAL'))?.details).toHaveLength(3);
    expect(loginRuleMessage(apiError('DEVICE_REJECTED'))?.title).toBe('Dispositivo no autorizado');
    expect(loginRuleMessage(apiError('DEVICE_REVOKED'))?.title).toBe('Autorización retirada');
    expect(loginRuleMessage(apiError('DEVICE_PROOF_INVALID'))?.variant).toBe('error');
    expect(loginRuleMessage(new DeviceKeyError())?.title).toBe('No se pudo registrar el dispositivo');
  });

  it('la ubicación sigue con su aviso y otros errores no tienen uno propio', () => {
    expect(loginRuleMessage(apiError('LOCATION_OUT_OF_RANGE'))?.title).toBe('Estás fuera del lugar permitido');
    expect(loginRuleMessage(apiError('INVALID_CREDENTIALS'))).toBeNull();
  });
});
