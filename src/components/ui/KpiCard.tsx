import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CountUp } from '../CountUp';
import { Skeleton } from './Skeleton';

export interface Kpi {
  key: string;
  label: string;
  icon: LucideIcon;
  /** undefined mientras carga. */
  value: number | undefined;
  /** Variante del ícono (p. ej. `icon-tile--success`). */
  tile?: string;
  /** Cómo se lee el valor (dinero, bytes, tiempo...); por omisión, el número tal cual. */
  format?: (value: number) => string;
  /** Línea breve bajo el valor (p. ej. "12 cargos · 30 sep 2026"). */
  hint?: ReactNode;
}

/** Valor del indicador con conteo animado (o esqueleto mientras carga). */
export function KpiValue({ value, format }: { value: number | null | undefined; format?: (value: number) => string }) {
  // Con formato (dinero, bytes, tiempo) el texto es más largo: un poco más chico para caber en la tarjeta.
  return <div className={format ? 'kpi__value kpi__value--text' : 'kpi__value'}>{value == null ? <Skeleton width={48} height={30} /> : <CountUp value={value} format={format} />}</div>;
}

export function KpiCard({ label, icon: Icon, value, tile = '', format, hint }: Omit<Kpi, 'key'>) {
  return (
    <div className="kpi">
      <span className={`icon-tile ${tile}`}>
        <Icon size={22} />
      </span>
      <span className="kpi__body">
        <span className="kpi__label">{label}</span>
        <KpiValue value={value} format={format} />
        {hint && <small className="kpi__hint">{hint}</small>}
      </span>
    </div>
  );
}

/** Fila de indicadores de una sección (con la entrada escalonada de la aplicación). */
export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="kpis stagger">
      {kpis.map(({ key, ...kpi }) => (
        <KpiCard key={key} {...kpi} />
      ))}
    </div>
  );
}
