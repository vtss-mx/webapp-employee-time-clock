import { KeyRound, Mail, MapPin, Radar, Ruler } from 'lucide-react';
import type { useValidatorForm } from '../hooks/useValidatorForm';
import { RADIUS_MAX_M, RADIUS_MIN_M } from '../hooks/useValidatorForm';
import { config } from '../utils/config';
import { ConfirmPasswordField, FormField } from './FormField';
import { QuickChoices } from './shifts/formFields';
import { metersText } from './shifts/shiftRules';
import { NumberField } from './ui/NumberField';
import { Switch } from './ui/Switch';
import { ValidatorModePicker } from './ValidatorModes';

type ValidatorForm = ReturnType<typeof useValidatorForm>;

/** Radios sugeridos (m): de una recepción a un predio grande. */
const RADIUS_CHOICES = [50, 100, 200, 500, 1000].map((meters) => ({ value: String(meters), text: metersText(meters) }));

/** Nombre, correo y contraseña inicial (solo en el alta: el correo no se cambia) y modo. */
export function ValidatorAccountFields({ form }: { form: ValidatorForm }) {
  const { values, errors, set, touch, saving } = form;
  return (
    <div className="stack">
      <div className="form-grid">
        <FormField
          label="Nombre o ubicación"
          icon={<MapPin size={18} />}
          required
          maxLength={120}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint="Así lo verás en la bitácora: p. ej. “Recepción planta 1”"
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        {form.creating && (
          <FormField
            label="Correo de acceso"
            icon={<Mail size={18} />}
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            disabled={saving}
            value={values.email}
            error={errors.email}
            status={form.emailStatus}
            hint="Con este correo iniciará sesión en la tableta o el teléfono"
            onBlur={() => touch('email')}
            onChange={(e) => set('email', e.target.value)}
          />
        )}
        {form.creating && (
          <FormField
            label="Contraseña inicial"
            icon={<KeyRound size={18} />}
            type="password"
            autoComplete="new-password"
            required
            disabled={saving}
            value={values.password}
            error={errors.password}
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
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
  const { values, errors, saving, locationRequired } = form;
  const radius = Number(values.radius);
  return (
    <div className="location-rule">
      <Switch
        checked={locationRequired}
        onChange={form.setLocationRequired}
        disabled={saving || !config.maps.apiKey}
        icon={<Radar size={20} />}
        label="Requiere ubicación"
        description={
          locationRequired
            ? `Solo podrá iniciar sesión a no más de ${Number.isFinite(radius) && radius > 0 ? `${radius.toLocaleString('es-MX')} m` : 'el radio indicado'} del punto marcado en el mapa. El dispositivo pedirá permiso de ubicación al iniciar sesión.`
            : 'Puede iniciar sesión desde cualquier lugar.'
        }
      />
      {locationRequired && (
        <div className="location-rule__radius">
          <NumberField
            label="Radio permitido (metros)"
            icon={<Ruler size={18} />}
            unit="m"
            min={RADIUS_MIN_M}
            max={RADIUS_MAX_M}
            step={10}
            required
            disabled={saving}
            value={values.radius}
            error={errors.radius}
            hint={`Entre ${RADIUS_MIN_M} y ${RADIUS_MAX_M.toLocaleString('es-MX')} m. Considera el tamaño del lugar y el margen del GPS.`}
            onBlur={() => form.touch('radius')}
            onChange={(value) => form.set('radius', value)}
          />
          <QuickChoices label="Radios sugeridos" value={values.radius} choices={RADIUS_CHOICES} disabled={saving} onPick={(value) => form.set('radius', value)} />
        </div>
      )}
    </div>
  );
}
