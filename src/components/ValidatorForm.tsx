import { KeyRound, Mail, MapPin, Radar, Ruler } from 'lucide-react';
import type { useValidatorForm } from '../hooks/useValidatorForm';
import { RADIUS_MAX_M, RADIUS_MIN_M, radiusLimits, radiusText } from '../hooks/useValidatorForm';
import { useT } from '../i18n';
import { config } from '../utils/config';
import { ConfirmPasswordField, FormField } from './FormField';
import { QuickChoices } from './ui/formFields';
import { metersText } from '../utils/numbers';
import { NumberField } from './ui/NumberField';
import { Switch } from './ui/Switch';
import { ValidatorModePicker } from './ValidatorModes';

type ValidatorForm = ReturnType<typeof useValidatorForm>;

/** Radios sugeridos (m): de una recepción a un predio grande. */
const RADIUS_CHOICES = [50, 100, 200, 500, 1000];
/** Las opciones con su texto en el idioma activo ("1 km"). */
const radiusChoices = () => RADIUS_CHOICES.map((meters) => ({ value: String(meters), text: metersText(meters) }));

/** Nombre, correo y contraseña inicial (solo en el alta: el correo no se cambia) y modo. */
export function ValidatorAccountFields({ form }: { form: ValidatorForm }) {
  const t = useT();
  const { values, errors, set, touch, saving } = form;
  return (
    <div className="stack">
      <div className="form-grid">
        <FormField
          label={t('validators.form.name')}
          icon={<MapPin size={18} />}
          required
          maxLength={120}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint={t('validators.form.nameHint')}
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        {form.creating && (
          <FormField
            label={t('validators.accessEmail')}
            icon={<Mail size={18} />}
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            disabled={saving}
            value={values.email}
            error={errors.email}
            status={form.emailStatus}
            hint={t('validators.form.emailHint')}
            onBlur={() => touch('email')}
            onChange={(e) => set('email', e.target.value)}
          />
        )}
        {form.creating && (
          <FormField
            label={t('validators.form.password')}
            icon={<KeyRound size={18} />}
            type="password"
            autoComplete="new-password"
            required
            disabled={saving}
            value={values.password}
            error={errors.password}
            hint={t('employees.fields.passwordHint')}
            onBlur={() => touch('password')}
            onChange={(e) => set('password', e.target.value)}
          />
        )}
        {form.creating && (
          <ConfirmPasswordField
            required
            disabled={saving}
            value={values.confirm}
            error={errors.confirm}
            onBlur={() => touch('confirm')}
            onChange={(e) => set('confirm', e.target.value)}
          />
        )}
      </div>
      <ValidatorModePicker value={form.mode} onChange={form.setMode} disabled={saving} />
    </div>
  );
}

/**
 * "Requiere ubicación": la cuenta solo inicia sesión a no más del radio (m) del punto del
 * domicilio. Sin mapa configurado no se puede exigir (no hay punto que marcar).
 */
export function ValidatorLocationRule({ form }: { form: ValidatorForm }) {
  const t = useT();
  const { values, errors, saving, locationRequired } = form;
  const radius = Number(values.radius);
  return (
    <div className="location-rule">
      <Switch
        checked={locationRequired}
        onChange={form.setLocationRequired}
        disabled={saving || !config.maps.apiKey}
        icon={<Radar size={20} />}
        label={t('validators.form.locationRequired')}
        description={
          locationRequired
            ? t('validators.form.locationOn', { radius: Number.isFinite(radius) && radius > 0 ? radiusText(radius) : t('validators.form.givenRadius') })
            : t('validators.form.anywhere')
        }
      />
      {locationRequired && (
        <div className="location-rule__radius">
          <NumberField
            label={t('validators.form.radius')}
            icon={<Ruler size={18} />}
            unit="m"
            min={RADIUS_MIN_M}
            max={RADIUS_MAX_M}
            step={10}
            required
            disabled={saving}
            value={values.radius}
            error={errors.radius}
            hint={t('validators.form.radiusHint', radiusLimits())}
            onBlur={() => form.touch('radius')}
            onChange={(value) => form.set('radius', value)}
          />
          <QuickChoices label={t('validators.form.suggestedRadii')} value={values.radius} choices={radiusChoices()} disabled={saving} onPick={(value) => form.set('radius', value)} />
        </div>
      )}
    </div>
  );
}
