/**
 * Confirmación previa a crear, editar o eliminar (decisión del dueño del producto: nada se crea,
 * cambia ni borra por accidente). La usan los hooks (`useConfirm`, `useAction`, `useSubmit`,
 * `useFormState`) y el popup (`ConfirmDialog`); vive aquí para que ningún hook dependa de un
 * componente.
 */
import type { ReactNode } from 'react';
import type { Lazy } from '../i18n/lazy';

/** Qué se confirma: define el ícono, el color, la etiqueta y el botón por omisión. */
export type ConfirmKind = 'create' | 'edit' | 'delete' | 'action';

/** Color de la confirmación y de su botón principal. */
export type ConfirmTone = 'primary' | 'success' | 'warning' | 'danger';

/** Un dato de lo que se crea o se afecta: una línea suelta o "Etiqueta: valor". */
export type ConfirmDetail = string | { label: string; value: ReactNode };

/** Un campo que cambia al editar: "Campo: antes → después" (valores ya legibles). */
export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

/**
 * Todo lo que se puede personalizar de una confirmación. Solo `title` es obligatorio: `kind` pone
 * lo demás (crear → "Crear" en azul, editar → "Guardar cambios", eliminar → "Eliminar" en rojo).
 */
export interface ConfirmInput {
  /** Por omisión `action` (una confirmación genérica). */
  kind?: ConfirmKind;
  /** La pregunta: "¿Eliminar a Ana Ruiz?". */
  title: string;
  /** Qué pasará al confirmar. */
  message?: ReactNode;
  /** Ícono propio en lugar del de `kind` (o del tono). */
  icon?: ReactNode;
  tone?: ConfirmTone;
  /** Etiqueta sobre el título (por omisión, la de `kind`). */
  eyebrow?: string;
  confirmLabel?: string;
  /** Ícono del botón principal (por omisión, el de `kind`). */
  confirmIcon?: ReactNode;
  cancelLabel?: string;
  /** Lo que se crea o se afecta: líneas o filas "Etiqueta: valor". */
  details?: ConfirmDetail[];
  /** Encabezado de `details` (p. ej. "Se registrará"). */
  detailsTitle?: string;
  /**
   * Edición: los campos que cambian ("antes → después", `describeChanges`). Una lista VACÍA
   * significa que no cambió nada: no se pregunta, se avisa "Sin cambios" y no se envía nada.
   */
  changes?: FieldChange[];
  /** Acciones muy destructivas: la persona escribe este texto (p. ej. el nombre) para confirmar. */
  confirmText?: string;
  /** La consecuencia, resaltada al final: "Esta acción no se puede deshacer". */
  note?: ReactNode;
}

/**
 * Una confirmación, o la función que la arma al dibujarse (`() => ({ title: t('…'), … })`): con la
 * función, una confirmación abierta sigue al idioma activo (textos, fechas y números se vuelven a
 * calcular). Se evalúa una vez al pedirla (p. ej. para saber si `changes` está vacía) y en cada dibujo.
 */
export type ConfirmSource = Lazy<ConfirmInput>;
