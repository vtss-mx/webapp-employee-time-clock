import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { CurrencyCode } from '../../types';
import { currencyText } from '../../utils/billing';
import { SelectField } from '../ui/formFields';

interface CurrencyFieldProps {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  /** Ayuda bajo el campo (por qué está fija, qué fija...). */
  hint: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Moneda del cobro: lista propia (`Select`, nunca la nativa) con las monedas activas del catálogo
 * `currencies`, cada una con su código, su nombre y su símbolo. Una que ya no está activa se sigue
 * mostrando si es la elegida (la empresa la conserva). La usan el plan de la empresa y el registro de un
 * pago; fija (`disabled`), la ayuda dice por qué.
 */
export function CurrencyField({ value, onChange, hint, error, disabled = false }: CurrencyFieldProps) {
  const t = useT();
  const { active, byCode, nameOf } = useCatalogs();
  const offered = active('currencies');
  const current = byCode('currencies', value);
  const items = current && !offered.includes(current) ? [...offered, current] : offered;
  const options = items.map((item) => ({
    value: item.code,
    label: currencyText(item.code, nameOf),
    description: item.description ?? undefined,
    icon: (
      <span className="currency-symbol" aria-hidden>
        {item.symbol}
      </span>
    ),
  }));
  return <SelectField<CurrencyCode> label={t('billing.plan.labels.currency')} value={value} options={options} onChange={onChange} hint={hint} error={error} required disabled={disabled} />;
}
