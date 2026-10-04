/**
 * La aplicación NO guarda nada en localStorage ni en sessionStorage (texto plano, síncrono y legible
 * por cualquier script): los datos de la persona viven en la BD, la sesión en una cookie HttpOnly, lo
 * del dispositivo en IndexedDB (`deviceStore`, `deviceKey`) y lo de la pestaña en memoria o en
 * `history.state`. ESLint lo prohíbe en todo el código salvo aquí.
 *
 * Este archivo solo BORRA lo que versiones anteriores dejaron, para que no quede en el navegador.
 */
const LEGACY_KEYS = [
  'tc.login.email',
  'tc.sidebar.collapsed',
  'tc.camera.granted',
  'tc.signed-in',
  'tc.camera.user',
  'tc.camera.environment',
  'tc.chunk-reload',
];

export function purgeLegacyStorage(): void {
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = storage();
      LEGACY_KEYS.forEach((key) => store.removeItem(key));
    } catch {
      // Almacenamiento bloqueado (modo privado estricto): tampoco hay nada que borrar.
    }
  }
}
