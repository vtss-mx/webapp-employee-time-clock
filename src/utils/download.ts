/** Descarga un archivo a partir de una URL (incluidas data URLs) con el nombre indicado. */
export function downloadUrl(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
