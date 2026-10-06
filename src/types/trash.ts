// Papelera («Eliminados»): todo borrado de la aplicación es lógico (decisión del dueño del producto). El
// registro eliminado se conserva `SOFT_DELETE_RETENTION_DAYS` (1 año) y se puede restaurar; después el backend
// lo depura. Lo biométrico y las fotos de una persona se borran para siempre al eliminarla.

/**
 * Cuándo y quién eliminó un registro (null mientras está vigente). El backend siempre los envía; son
 * opcionales aquí para que un registro sin ellos (pruebas, respuestas anteriores) cuente como vigente.
 */
export interface SoftDeleted {
  /** Instante de la eliminación (UTC; se muestra con `formatDateTime`). */
  deleted_at?: string | null;
  /** Correo de quien lo eliminó (literal). */
  deleted_by?: string | null;
}

/**
 * Referencia histórica (un empleado, un turno o un sitio dentro de una jornada, una ausencia o una
 * solicitud): `deleted` dice que ya está en «Eliminados» (se muestra con su marca junto al nombre).
 */
export interface DeletedFlag {
  deleted?: boolean;
}

/** Lo que devuelve restaurar: el registro de vuelta y el mensaje del servidor (ya traducido). */
export interface Restored<T> {
  item: T;
  message: string;
}
