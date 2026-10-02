/**
 * Menú de teléfonos y tabletas (hamburguesa). Todo lo personalizable vive aquí y en los tokens de
 * `global.css` (`--mobilebar-h`, `--drawer-w`); las opciones del menú las envía el backend.
 */
export interface MobileMenuConfig {
  /** Lado de la pantalla por el que entra el menú. */
  side: 'left' | 'right';
  /** La barra muestra el nombre de la pantalla actual. */
  showTitle: boolean;
  /** La barra muestra el ícono de la aplicación (lleva al inicio). */
  showBrand: boolean;
  /** El botón del menú muestra la suma de los contadores (p. ej. validaciones pendientes). */
  badgeOnToggle: boolean;
  /** Elegir una opción cierra el menú. */
  closeOnNavigate: boolean;
}

export const MOBILE_MENU: MobileMenuConfig = {
  side: 'left',
  showTitle: true,
  showBrand: true,
  badgeOnToggle: true,
  closeOnNavigate: true,
};
