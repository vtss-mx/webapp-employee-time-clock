/**
 * Archivos que entrega el backend dentro del contrato (base64 en `data`, p. ej. el comprobante de un
 * pago): se convierten en un `Blob` y se guardan con su nombre. Nada se escribe en el navegador más
 * allá de la descarga que la persona pidió; la URL temporal se libera al terminar.
 */

/** Tiempo que vive la URL temporal (lo que tarda el navegador en empezar la descarga). */
const REVOKE_AFTER_MS = 30_000;

/** base64 → Blob del tipo indicado. */
export function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Descarga un archivo con su nombre (enlace temporal con `download`, sin abrir otra pestaña). */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
