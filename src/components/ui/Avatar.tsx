import { useState } from 'react';
import { useAvatarImage, useInView } from '../../hooks/useAvatarImage';
import { useT } from '../../i18n';
import type { AvatarSize } from '../../types/avatar';
import { initials } from '../../utils/format';

/** xs 28 · sm 32 · md 40 · lg 64 · xl 112 px (tokens `--avatar-size-*`). */
export type AvatarScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Tonos de las iniciales (`--avatar-tone-N-bg` / `-fg` en global.css). */
export const AVATAR_TONES = 8;

/** Tono estable: el mismo nombre (o id) da siempre el mismo color, en cualquier pantalla y dispositivo. */
export function avatarTone(seed: string | number): number {
  let hash = 0;
  for (const char of String(seed)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return (hash % AVATAR_TONES) + 1;
}

const LARGE: ReadonlySet<AvatarScale> = new Set(['lg', 'xl']);

export interface AvatarProps {
  /** Nombre de la persona: sus iniciales y el texto alternativo. */
  name: string;
  /** Ruta versionada de su foto (`user.avatar`, `employee.avatar`); sin ella se ven las iniciales. */
  src?: string | null;
  size?: AvatarScale;
  /** Semilla del color de las iniciales (por omisión, el nombre). */
  seed?: string | number;
  /** Texto alternativo propio (por omisión "Foto de perfil de {name}"). */
  alt?: string;
  /** Junto al nombre ya escrito: el lector de pantalla no lo repite. */
  decorative?: boolean;
  /** Tamaño de la imagen que se pide: por omisión 512 en lg y xl, 96 en los demás. */
  quality?: AvatarSize;
  className?: string;
}

/**
 * Foto de perfil de una persona o, mientras no llega (o si no tiene), sus iniciales con un color propio. La foto
 * se pide por la API con la sesión (`useAvatarImage`; nunca una URL del bucket) y solo cuando el avatar se ve en
 * pantalla; la misma foto se descarga una vez para toda la página.
 */
export function Avatar({ name, src, size = 'md', seed, alt, decorative = false, quality, className }: AvatarProps) {
  const t = useT();
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const visible = useInView(element, Boolean(src));
  const url = useAvatarImage(src, quality ?? (LARGE.has(size) ? 512 : 96), visible);
  const classes = ['avatar', `avatar--${size}`, `avatar--tone-${avatarTone(seed ?? name)}`, url && 'has-image', className];
  return (
    <span
      ref={setElement}
      className={classes.filter(Boolean).join(' ')}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : (alt ?? t('avatar.alt', { name }))}
      aria-hidden={decorative || undefined}
    >
      <span className="avatar__initials" aria-hidden>
        {initials(name)}
      </span>
      {url && <img className="avatar__image" src={url} alt="" loading="lazy" decoding="async" draggable={false} />}
    </span>
  );
}
