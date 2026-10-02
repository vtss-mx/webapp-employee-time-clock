import { useState } from 'react';

/**
 * Reacciona a un cambio de `value` (prop) durante el render, no en un efecto: el estado derivado
 * se ajusta en el mismo render y un efecto pendiente no puede pisar lo que el usuario acaba de
 * hacer. Patrón recomendado por React para "ajustar estado cuando cambia una prop".
 */
export function useSyncOnChange<T>(value: T, onChange: (value: T) => void): void {
  const [synced, setSynced] = useState(value);
  if (!Object.is(synced, value)) {
    setSynced(value);
    onChange(value);
  }
}
