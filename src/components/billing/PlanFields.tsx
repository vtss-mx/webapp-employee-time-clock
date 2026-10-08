import { BadgePercent, Building2, Users } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { PlanForm } from '../../hooks/usePlanForm';
import { useT } from '../../i18n';
import type { DiscountRecurrence, DiscountType, PricePeriod, PricingMode } from '../../types';
import { PLAN_LIMITS } from '../../utils/billing';
import { catalogOptions } from '../../utils/catalogs';
import { SelectField } from '../shifts/formFields';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { DateField } from '../ui/DateField';
import { NumberField } from '../ui/NumberField';
import { RadioCard } from '../ui/RadioCard';
import { Switch } from '../ui/Switch';
import { CurrencyField } from './CurrencyField';
import { inSentence } from '../../utils/text';

interface PlanFieldsProps {
  form: PlanForm;
  disabled?: boolean;
  /** La empresa ya tiene cargos o pagos: su moneda no se puede cambiar (el backend respondería 422 `CURRENCY_LOCKED`). */
  currencyLocked?: boolean;
}

const MODE_ICONS: Record<PricingMode, typeof Users> = { PER_USER: Users, FLAT: Building2 };

/** Descuento opcional: tipo (porcentaje o monto en la moneda del plan), valor y a qué cargos aplica. */
function DiscountFields({ form, disabled }: PlanFieldsProps) {
  const t = useT();
  const { active } = useCatalogs();
  const { values, set, touch, errors } = form;
  const percent = values.discount_type === 'PERCENT';
  const recurrences = catalogOptions(active('discount_recurrences'));
  return (
    <div className="plan-fields__discount stack">
      <Switch
        checked={values.discount}
        onChange={(on) => set('discount', on)}
        icon={<BadgePercent size={20} />}
        label={t('billing.plan.labels.discount')}
        description={t('billing.plan.fields.discountDescription')}
        disabled={disabled}
      />
      {values.discount && (
        <div className="form-grid">
          <ChoiceGroup label={t('billing.plan.fields.discountType')} radio className="plan-fields__choices">
            {active('discount_types').map((type) => (
              <RadioCard<DiscountType>
                key={type.code}
                name="discount_type"
                value={type.code}
                checked={values.discount_type === type.code}
                onChange={(next) => set('discount_type', next)}
                title={type.name}
                description={type.description}
                size="sm"
                disabled={disabled}
              />
            ))}
          </ChoiceGroup>
          <NumberField
            label={percent ? t('billing.plan.fields.discountPercent') : t('billing.plan.fields.discountAmount')}
            value={values.discount_value}
            onChange={(next) => set('discount_value', next)}
            onBlur={() => touch('discount_value')}
            decimals={2}
            min={0}
            max={percent ? PLAN_LIMITS.percent.max : PLAN_LIMITS.amount.max}
            unit={percent ? '%' : values.currency}
            hint={percent ? t('billing.plan.fields.discountPercentHint') : t('billing.plan.fields.discountAmountHint')}
            error={errors.discount_value}
            required
            disabled={disabled}
          />
          <SelectField<DiscountRecurrence>
            label={t('billing.plan.fields.recurrence')}
            value={values.discount_recurrence}
            options={recurrences}
            onChange={(next) => set('discount_recurrence', next)}
            disabled={disabled}
          />
          {values.discount_recurrence !== 'ALWAYS' && (
            <NumberField
              label={values.discount_recurrence === 'FIRST' ? t('billing.plan.fields.periodsFirst') : t('billing.plan.fields.periodsEvery')}
              value={values.discount_periods}
              onChange={(next) => set('discount_periods', next)}
              onBlur={() => touch('discount_periods')}
              min={PLAN_LIMITS.periods.min}
              max={PLAN_LIMITS.periods.max}
              unit={t('billing.plan.fields.periodsUnit', { count: Number(values.discount_periods) || 0 })}
              error={errors.discount_periods}
              required
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Campos del plan de cobro de una empresa (alta y edición): modalidad (por empleado activo o monto
 * fijo), moneda, precio sin IVA y a qué tiempo corresponde, cada cuántos meses se cobra, inicio, días de
 * demo, descuento, IVA y días de gracia. Nombres y aclaraciones de las opciones vienen de los catálogos.
 */
export function PlanFields({ form, disabled = false, currencyLocked = false }: PlanFieldsProps) {
  const t = useT();
  const { active, nameOf } = useCatalogs();
  const { values, set, touch, errors } = form;
  const periods = catalogOptions(active('price_periods'));
  const perUser = values.pricing_mode === 'PER_USER';
  const period = inSentence(nameOf('price_periods', values.price_period));
  return (
    <div className="plan-fields stack">
      <ChoiceGroup label={t('billing.plan.labels.mode')} radio className="plan-fields__choices">
        {active('pricing_modes').map((mode) => {
          const Icon = MODE_ICONS[mode.code];
          return (
            <RadioCard<PricingMode>
              key={mode.code}
              name="pricing_mode"
              value={mode.code}
              checked={values.pricing_mode === mode.code}
              onChange={(next) => set('pricing_mode', next)}
              title={mode.name}
              description={mode.description}
              icon={<Icon size={20} />}
              size="sm"
              disabled={disabled}
            />
          );
        })}
      </ChoiceGroup>
      <div className="form-grid">
        <CurrencyField
          value={values.currency}
          onChange={(next) => set('currency', next)}
          hint={currencyLocked ? t('billing.currency.lockedHint') : t('billing.plan.fields.currencyHint')}
          error={errors.currency}
          disabled={disabled || currencyLocked}
        />
        <NumberField
          label={perUser ? t('billing.plan.fields.pricePerEmployee') : t('billing.plan.fields.priceFlat')}
          value={values.unit_price}
          onChange={(next) => set('unit_price', next)}
          onBlur={() => touch('unit_price')}
          decimals={2}
          min={PLAN_LIMITS.price.min}
          max={PLAN_LIMITS.price.max}
          unit={values.currency}
          hint={perUser ? t('billing.plan.fields.priceHintPerEmployee', { period }) : t('billing.plan.fields.priceHint', { period })}
          error={errors.unit_price}
          required
          disabled={disabled}
        />
        <SelectField<PricePeriod> label={t('billing.plan.fields.pricePeriod')} value={values.price_period} options={periods} onChange={(next) => set('price_period', next)} disabled={disabled} />
        <NumberField
          label={t('billing.plan.fields.interval')}
          value={values.interval_months}
          onChange={(next) => set('interval_months', next)}
          onBlur={() => touch('interval_months')}
          min={PLAN_LIMITS.interval.min}
          max={PLAN_LIMITS.interval.max}
          unit={t('billing.plan.fields.monthsUnit', { count: Number(values.interval_months) || 0 })}
          hint={t('billing.plan.fields.intervalHint')}
          error={errors.interval_months}
          required
          disabled={disabled}
        />
        <DateField
          label={t('billing.plan.labels.startsOn')}
          name="starts_on"
          value={values.starts_on}
          onChange={(next) => {
            set('starts_on', next);
            touch('starts_on');
          }}
          hint={t('billing.plan.fields.startsOnHint')}
          error={errors.starts_on}
          required
          disabled={disabled}
        />
        <NumberField
          label={t('billing.plan.fields.trial')}
          value={values.trial_days}
          onChange={(next) => set('trial_days', next)}
          onBlur={() => touch('trial_days')}
          min={PLAN_LIMITS.trial.min}
          max={PLAN_LIMITS.trial.max}
          unit={t('billing.plan.fields.daysUnit')}
          hint={t('billing.plan.fields.trialHint')}
          error={errors.trial_days}
          required
          disabled={disabled}
        />
        <NumberField
          label={t('billing.plan.labels.tax')}
          value={values.tax_rate}
          onChange={(next) => set('tax_rate', next)}
          onBlur={() => touch('tax_rate')}
          decimals={2}
          min={PLAN_LIMITS.tax.min}
          max={PLAN_LIMITS.tax.max}
          unit="%"
          hint={t('billing.plan.fields.taxHint')}
          error={errors.tax_rate}
          required
          disabled={disabled}
        />
        <NumberField
          label={t('billing.plan.labels.grace')}
          value={values.grace_days}
          onChange={(next) => set('grace_days', next)}
          onBlur={() => touch('grace_days')}
          min={PLAN_LIMITS.grace.min}
          max={PLAN_LIMITS.grace.max}
          unit={t('billing.plan.fields.daysUnit')}
          hint={t('billing.plan.fields.graceHint')}
          error={errors.grace_days}
          required
          disabled={disabled}
        />
      </div>
      <DiscountFields form={form} disabled={disabled} />
    </div>
  );
}
