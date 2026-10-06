/**
 * Foto de perfil (de la persona, no de una empresa): contrato con la API. La imagen vive cifrada en el bucket
 * de la plataforma y solo se lee por la API con la sesión (nunca una URL pública ni firmada).
 */

/** Tamaños que guarda el backend (lado del cuadrado en px): 96 para menús y listas, 512 para el perfil. */
export type AvatarSize = 96 | 512;

/** Recorte cuadrado elegido, en píxeles de la imagen ya orientada (como la muestra el navegador). */
export interface AvatarCrop {
  x: number;
  y: number;
  size: number;
}

/** La foto vigente tras subirla o quitarla (`avatar` null = sin foto). */
export interface AvatarRead {
  avatar: string | null;
  version: string | null;
}

/** Un tamaño de la foto, descifrado por el backend (base64: el contrato único es JSON). */
export interface AvatarImage {
  user_id: number;
  size_px: AvatarSize;
  version: string;
  content_type: string;
  data: string;
}
