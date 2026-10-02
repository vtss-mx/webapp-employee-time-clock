import type { LucideIcon } from 'lucide-react';
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
}

/** Valor del indicador con conteo animado (o esqueleto mientras carga). */
export function KpiValue({ value }: { value: number | null | undefined }) {
  return <div className="kpi__value">{value == null ? <Skeleton width={48} height={30} /> : <CountUp value={value} />}</div>;
}

export function KpiCard({ label, icon: Icon, value, tile = '' }: Omit<Kpi, 'key'>) {
  return (
    <div className="kpi">
      <span className={`icon-tile ${tile}`}>
        <Icon size={22} />
      </span>
      <span>
        <span className="kpi__label">{label}</span>
        <KpiValue value={value} />
      </span>
    </div>
  );
}
