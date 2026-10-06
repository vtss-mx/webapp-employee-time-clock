import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * ¿El backend le dio al usuario esta pantalla (`user.screens`)? Para mostrar un enlace hacia otra
 * pantalla solo a quien puede abrirla (p. ej. "Abrir cobranza" desde la ficha de una empresa). Sin
 * sesión no hay pantallas: nada se ofrece.
 */
export function useHasScreen(code: string): boolean {
  return useContext(AuthContext)?.user?.screens.some((screen) => screen.code === code) ?? false;
}
