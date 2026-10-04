import type { CSSProperties } from 'react';

export interface RangeMeterProps {
  value: number;
  /** Extremos del rango (p. ej. el mínimo y el tope de un umbral). */
  min: number;
  max: number;
  /** Nombre accesible del medidor. */
  label: string;
  /** Formato de los valores (por omisión, hasta 3 decimales). */
  format?: (value: number) => string;
  /** Textos de los extremos (por omisión, "Mínimo" y "Tope"). */
  labels?: { min?: string; max?: string };
  /** Color de la barra: primary (azul), success (verde) o warning (ámbar). */
  tone?: 'primary' | 'success' | 'warning';
  className?: string;
}

const plain = (value: number) => value.toLocaleString('es-MX', { maximumFractionDigits: 3 });

/**
 * Medidor propio de un valor dentro de un rango (nunca `<meter>` ni `<progress>` nativos): barra con
 * el tramo recorrido, un marcador en el valor y los extremos con su texto. Se dibuja con los tokens
 * `--meter-*` y expone `role="meter"` para lectores de pantalla.
 */
export function RangeMeter({ value, min, max, label, format = plain, labels = {}, tone = 'primary', className = '' }: RangeMeterProps) {
  const span = max - min;
  const ratio = span > 0 ? Math.max(0, Math.min(1, (value - min) / span)) : 1;
  return (
    <div className={`range-meter range-meter--${tone} ${className}`.trim()}>
      <div
        className="range-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        style={{ '--meter': ratio } as CSSProperties}
      >
        <span className="range-meter__fill" />
        <span className="range-meter__thumb" />
      </div>
      <div className="range-meter__scale" aria-hidden>
        <span>
          {labels.min ?? 'Mínimo'} {format(min)}
        </span>
        <span>
          {labels.max ?? 'Tope'} {format(max)}
        </span>
      </div>
    </div>
  );
}
