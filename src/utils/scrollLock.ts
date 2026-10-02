/**
 * Bloqueo del desplazamiento de la página con contador: si un popup se abre sobre un modal,
 * cerrar el popup no debe desbloquear la página mientras el modal siga abierto.
 */
let locks = 0;

export function lockScroll(): () => void {
  locks++;
  document.body.classList.add('no-scroll');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.classList.remove('no-scroll');
  };
}
