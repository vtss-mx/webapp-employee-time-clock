import { t, useT } from '../../i18n';
import type { ChargeLine, ChargeTotals, CurrencyCode, PricingMode } from '../../types';
import { daysText, monthLabel, unitsText } from '../../utils/billing';
import { formatMoney, moneyValue } from '../../utils/numbers';

export interface MoneyRow {
  label: string;
  /** Dinero del contrato ("1234.50"), en la moneda de los renglones. */
  value: string;
  /** discount: se lee restando; total: resaltado; muted: dato secundario. */
  kind?: 'discount' | 'total' | 'muted';
}

/** Subtotal, descuento (solo si hay), IVA y total de un cargo (se pide al dibujar: sigue al idioma). */
export function totalsRows(totals: ChargeTotals): MoneyRow[] {
  return [
    { label: t('billing.totals.subtotal'), value: totals.subtotal },
    ...(moneyValue(totals.discount) > 0 ? [{ label: t('billing.totals.discount'), value: totals.discount, kind: 'discount' as const }] : []),
    { label: t('billing.totals.tax'), value: totals.tax },
    { label: t('billing.totals.total'), value: totals.total, kind: 'total' },
  ];
}

/** Renglones de dinero alineados a la derecha (totales de un cargo, del pronóstico o de la vista previa), en su moneda. */
export function MoneyRows({ rows, currency, label }: { rows: MoneyRow[]; currency: CurrencyCode; label?: string }) {
  return (
    <dl className="money-rows" aria-label={label}>
      {rows.map((row) => (
        <div key={row.label} className={`money-rows__row money-rows__row--${row.kind ?? 'plain'}`}>
          <dt>{row.label}</dt>
          <dd>{row.kind === 'discount' ? `−${formatMoney(row.value, currency)}` : formatMoney(row.value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface ChargeLinesProps {
  lines: ReadonlyArray<ChargeLine & { projected?: boolean }>;
  mode: PricingMode;
  currency: CurrencyCode;
}

/**
 * Detalle de un cargo por mes (un periodo puede abarcar varios meses): días, lo que se cobra
 * (días-persona, con su desglose de validadores, o días) y el importe sin IVA en su moneda. Con el pronóstico, marca los meses que
 * incluyen días que aún no pasan. Son a lo más 12 renglones: no se paginan.
 */
export function ChargeLines({ lines, mode, currency }: ChargeLinesProps) {
  const t = useT();
  return (
    <div className="table-wrap">
      <table className="table table--readonly">
        <thead>
          <tr>
            <th>{t('billing.lines.month')}</th>
            <th>{t('billing.lines.days')}</th>
            <th>{mode === 'PER_USER' ? t('billing.lines.personDays') : t('billing.lines.billedDays')}</th>
            <th>{t('billing.lines.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.month}>
              <td className="table__primary">
                <strong className="month-label">{monthLabel(line.month)}</strong>
                {line.projected && <small className="muted"> · {t('billing.lines.projected')}</small>}
              </td>
              <td data-label={t('billing.lines.days')}>{daysText(line.days)}</td>
              <td data-label={t('billing.lines.billed')}>{unitsText(line.units, mode, line.validator_units)}</td>
              <td data-label={t('billing.lines.amount')}>{formatMoney(line.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
