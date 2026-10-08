/** La huella SHA-256 (hexadecimal) de un blob: lo que se firma de una captura (WebCrypto, contexto seguro). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
