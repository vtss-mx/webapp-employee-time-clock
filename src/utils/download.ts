import type { DownloadedFile } from '../services/apiClient';

/**
 * Guarda en el dispositivo un archivo descargado (p. ej. el Excel de un reporte) con el nombre que
 * propuso el servidor. El enlace temporal se libera enseguida: el archivo no queda en memoria.
 */
export function saveFile(file: DownloadedFile, fallbackName: string): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename ?? fallbackName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
