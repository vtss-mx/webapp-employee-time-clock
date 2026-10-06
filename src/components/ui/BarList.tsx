import type { CSSProperties, ReactNode } from 'react';

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Dato secundario junto al valor (p. ej. "1,204 registros"). */
  detail?: ReactNode;
  /** Ayuda del renglón (globo del sistema). */
  title?: string;
}

interface BarListProps {
  /** Nombre accesible de la lista. */
  label: string;
  items: readonly BarItem[];
  /** Cómo se lee cada valor. */
  format: (value: number) => string;
  /** Contra qué se mide cada barra: el mayor de la lista (por omisión) o el total (su parte del todo). */
  scale?: 'max' | 'total';
  className?: string;
}

/**
 * Barras horizontales con su etiqueta y su valor escrito (almacenamiento por categoría, rutas más
 * usadas): el valor siempre se lee como texto; la barra solo lo dibuja (oculta a lectores de pantalla).
 * Colores con los tokens `--chart-*`.
 */
export function BarList({ label, items, format, scale = 'max', className = '' }: BarListProps) {
  const values = items.map((item) => Math.max(0, item.value));
  const base = scale === 'total' ? values.reduce((sum, value) => sum + value, 0) : Math.max(0, ...values);
  return (
    <ul className={`bar-list ${className}`.trim()} aria-label={label}>
      {items.map((item, index) => (
        <li key={item.key} className="bar-list__item" title={item.title}>
          <span className="bar-list__label">{item.label}</span>
          <span className="bar-list__value">
            <strong>{format(item.value)}</strong>
            {item.detail && <small>{item.detail}</small>}
          </span>
          <span className="bar-list__track" aria-hidden>
            <span className="bar-list__fill" style={{ '--value': base > 0 ? values[index] / base : 0 } as CSSProperties} />
          </span>
        </li>
      ))}
    </ul>
  );
}
