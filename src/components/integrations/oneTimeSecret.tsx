import type { ReactNode } from 'react';
import type { MessageInput } from '../MessageDialog';
import { CopyField } from '../ui/CopyField';

/**
 * Un secreto que la plataforma muestra UNA sola vez y que **no se guarda en ninguna parte**: el secreto de una
 * llave de la API (en la base solo queda su hash) y la clave PRIVADA de un par que la plataforma generó (que ni el
 * servidor conserva, migración 0105). Es la misma mecánica, así que vive una sola vez (regla 6 de la raíz):
 *
 * - El valor viaja solo en la respuesta y de ahí al popup: **nunca** a `localStorage`, `sessionStorage`, IndexedDB
 *   ni al estado de una ruta (`navigate(..., { state })`), que sobreviviría a la navegación y al recargar.
 * - Vive en la función que arma el mensaje (así el popup abierto sigue al idioma activo) y esa función vive en la
 *   cola de popups. Al cerrarlo, la cola suelta la función y con ella el valor: no queda en ningún lado.
 * - `dismissible: false`: solo se cierra con «Ya lo guardé», para que nadie lo pierda con un clic fuera o Escape.
 *
 * Quien lo use pasa los textos ya traducidos (`t('…')` dentro de la función del popup).
 */
export interface OneTimeSecret {
  /** Lo que se muestra una sola vez (el secreto de la llave o la clave privada en PEM). */
  value: string;
  icon: ReactNode;
  /** Etiqueta sobre el título («Llave creada», «Par de claves generado»). */
  eyebrow: string;
  title: string;
  /** Una frase: qué hacer con él y que no se volverá a mostrar. */
  text: string;
  /** Nombre accesible del botón de copiar. */
  copyLabel: string;
  /** Garantías y pasos bajo el texto (dónde guardarlo, qué hacer si se pierde). */
  details: string[];
  /** Etiqueta del único botón («Ya la guardé»). */
  saved: string;
  /** Mientras uno con la misma clave esté abierto o en cola, no se repite. */
  key: string;
  /** Texto largo en varias líneas (una clave en PEM); por omisión, una sola línea. */
  multiline?: boolean;
}

/** Popup de un secreto que solo se ve una vez. */
export function oneTimeSecretMessage(secret: OneTimeSecret): MessageInput {
  return {
    variant: 'success',
    icon: secret.icon,
    eyebrow: secret.eyebrow,
    title: secret.title,
    text: secret.text,
    body: <CopyField value={secret.value} label={secret.copyLabel} multiline={secret.multiline} />,
    details: secret.details,
    detailsStyle: 'checks',
    actions: [{ id: 'saved', label: secret.saved, variant: 'primary' }],
    dismissible: false,
    key: secret.key,
  };
}
