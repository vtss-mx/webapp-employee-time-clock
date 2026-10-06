import type { AvatarCrop, AvatarImage, AvatarRead, AvatarSize } from '../types/avatar';
import { config } from '../utils/config';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

const isAvatarRead = hasKeys<AvatarRead>('avatar', 'version');
const isAvatarImage = hasKeys<AvatarImage>('content_type', 'data', 'version');

/** La ruta versionada de `user.avatar` con el tamaño que se pide (la ruta ya trae `?v=`). */
export function avatarPath(src: string, size: AvatarSize): string {
  return `${src}${src.includes('?') ? '&' : '?'}size=${size}`;
}

/** Los bytes de un base64 como `Blob` (para una URL `blob:` local que la etiqueta `<img>` puede mostrar). */
export function blobOf(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Foto de perfil de la persona autenticada (subir, cambiar, quitar) y las fotos que puede ver (la suya, las de su
 * empresa). Todo pasa por la API con la sesión: el bucket nunca se toca desde el navegador.
 */
export const avatarService = {
  /** Sube (o reemplaza) la foto con el recorte elegido. El servidor quita los metadatos y la guarda cifrada. */
  upload(file: File, crop: AvatarCrop | null, signal?: AbortSignal): Promise<AvatarRead> {
    const body = new FormData();
    body.append('file', file);
    if (crop) {
      body.append('crop_x', String(crop.x));
      body.append('crop_y', String(crop.y));
      body.append('crop_size', String(crop.size));
    }
    return apiRequest<AvatarRead>('/users/me/avatar', { method: 'PUT', body, signal, timeoutMs: config.apiUploadTimeoutMs, validate: isAvatarRead });
  },

  /** Quita la foto (se vuelven a ver las iniciales). */
  remove(): Promise<AvatarRead> {
    return apiRequest<AvatarRead>('/users/me/avatar', { method: 'DELETE', validate: isAvatarRead });
  },

  /**
   * Un tamaño de una foto como `Blob`. El backend la entrega con `ETag` y caché privada por versión (la URL
   * cambia con cada foto nueva), así que el navegador no la vuelve a descargar mientras no cambie.
   */
  async image(src: string, size: AvatarSize, signal?: AbortSignal): Promise<Blob> {
    const image = await apiRequest<AvatarImage>(avatarPath(src, size), { signal, validate: isAvatarImage });
    return blobOf(image.data, image.content_type);
  },
};
