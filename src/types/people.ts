/**
 * Referencia a una persona dentro de otra respuesta (un caso de fraude, una verificación, un listado).
 *
 * Vive aparte porque la nombran varios módulos y ninguno es su dueño: trae lo mínimo para mostrarla —su nombre, su
 * número (opcional) y su foto de perfil, que el backend decide quién ve (regla 13)— y la marca `deleted` cuando el
 * registro ya está en «Eliminados» (regla 20: el historial sigue nombrándolo).
 */
import type { WithAvatar } from './avatar';
import type { DeletedFlag } from './trash';

export interface EmployeeRef extends DeletedFlag, WithAvatar {
  id: number;
  full_name: string;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
}
