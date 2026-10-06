import type { Restored } from '../../types';
import type { Guard } from '../../utils/guards';
import { apiEnvelope } from '../apiClient';

/**
 * Restaura un registro de «Eliminados» (`POST {ruta}/restore`; la autoriza la misma pantalla y el mismo rol que
 * eliminarlo): devuelve el registro de vuelta y el mensaje del servidor, ya traducido, que es el texto del aviso.
 * Si algo ocupa ya su lugar (409 `RESTORE_CONFLICT`) o una regla lo impide, el error trae el motivo.
 */
export async function restoreRecord<T>(path: string, validate: Guard<T>): Promise<Restored<T>> {
  const { data, message } = await apiEnvelope<T>(`${path}/restore`, { method: 'POST', validate });
  return { item: data, message };
}
