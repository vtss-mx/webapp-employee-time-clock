/**
 * Pin de la marca (SVG propio: nítido en cualquier pantalla), compartido por el selector de domicilios (`MapCanvas`) y
 * el mapa de solo lectura de las verificaciones (`VerificationMap`), para no duplicar el dibujo (regla 6). Gota con el
 * color `--map-pin`, aro blanco, brillo sutil y un disco blanco con el punto al centro; la punta marca el punto exacto.
 */
export function PinMark({ label }: { label: string }) {
  return (
    <svg className="map-canvas__pin" viewBox="0 0 44 56" width="44" height="56" role="img" aria-label={label}>
      <title>{label}</title>
      <path className="map-canvas__pin-body" d="M22 2C11.5 2 3 10.3 3 20.6c0 12.8 13.6 27.1 17.5 32.6a1.9 1.9 0 0 0 3 0C27.4 47.7 41 33.4 41 20.6 41 10.3 32.5 2 22 2z" />
      <path className="map-canvas__pin-shine" d="M22 4.5c-9.1 0-16.5 7.2-16.5 16.1 0 1.4.2 2.8.6 4.2C8 15.6 14.6 9 22 9s14 6.6 15.9 15.8c.4-1.4.6-2.8.6-4.2 0-8.9-7.4-16.1-16.5-16.1z" />
      <circle className="map-canvas__pin-disc" cx="22" cy="20.6" r="8.5" />
      <circle className="map-canvas__pin-dot" cx="22" cy="20.6" r="4" />
    </svg>
  );
}
