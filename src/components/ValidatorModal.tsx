import { KeyRound, Mail, MapPin, Pencil, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { ApiError } from '../services/apiClient';
import { validatorService } from '../services/validatorService';
import type { Validator, ValidatorMode } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { ValidatorModePicker } from './ValidatorModes';

export type ValidatorDialog = { kind: 'create' } | { kind: 'edit'; validator: Validator } | { kind: 'password'; validator: Validator };

const NAME_MAX = 120;
const COPY = {
  create: {
    title: 'Agregar validador',
    Icon: ScanLine,
    action: 'Agregar',
    failed: 'No se pudo agregar el validador',
    done: (v: Validator) => ['Validador agregado', `${v.email} ya puede iniciar sesión desde una tableta o un teléfono.`],
  },
  edit: {
    title: 'Editar validador',
    Icon: Pencil,
    action: 'Guardar',
    failed: 'No se pudo guardar el validador',
    done: (v: Validator) => ['Validador actualizado', `${v.name} ya identifica con el modo elegido.`],
  },
  password: {
    title: 'Restablecer contraseña',
    Icon: KeyRound,
    action: 'Restablecer',
    failed: 'No se pudo restablecer la contraseña',
    done: (v: Validator) => ['Contraseña restablecida', `${v.email} debe iniciar sesión de nuevo: sus sesiones abiertas se cerraron.`],
  },
} as const;

function validateValidatorName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return 'Escribe un nombre o ubicación (p. ej. "Recepción planta 1")';
  return name.length > NAME_MAX ? `Máximo ${NAME_MAX} caracteres` : undefined;
}

interface ValidatorModalProps {
  dialog: ValidatorDialog;
  onClose: () => void;
  onSaved: (validator: Validator) => void;
}

type Field = 'name' | 'email' | 'password';
interface Values {
  name: string;
  email: string;
  password: string;
  mode: ValidatorMode;
}

/** Valores del formulario, qué campos pide cada diálogo y sus errores visibles. */
function useValidatorForm(dialog: ValidatorDialog) {
  const current = dialog.kind === 'create' ? null : dialog.validator;
  const [values, setValues] = useState<Values>({ name: current?.name ?? '', email: '', password: '', mode: current?.mode ?? 'QR_OR_FACE' });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ name: false, email: false, password: false });
  const [emailTaken, setEmailTaken] = useState<string>();
  const asks: Record<Field, boolean> = { name: dialog.kind !== 'password', email: dialog.kind === 'create', password: dialog.kind !== 'edit' };
  const problems: Record<Field, string | undefined> = {
    name: asks.name ? validateValidatorName(values.name) : undefined,
    email: asks.email ? (emailTaken ?? validateEmail(values.email)) : undefined,
    password: asks.password ? validatePassword(values.password) : undefined,
  };
  return {
    current,
    values,
    asks,
    valid: !problems.name && !problems.email && !problems.password,
    shown: (field: Field) => (touched[field] || (field === 'email' && emailTaken) ? problems[field] : undefined),
    touch: (field: Field) => setTouched((t) => ({ ...t, [field]: true })),
    set: <K extends keyof Values>(key: K, value: Values[K]) => {
      setValues((v) => ({ ...v, [key]: value }));
      if (key === 'email') setEmailTaken(undefined);
    },
    setEmailTaken,
  };
}

function persist(dialog: ValidatorDialog, { name, email, password, mode }: Values): Promise<Validator> {
  if (dialog.kind === 'create') return validatorService.create({ name, email, password, mode });
  if (dialog.kind === 'edit') return validatorService.update(dialog.validator.id, { name: name.trim(), mode });
  return validatorService.resetPassword(dialog.validator.id, password);
}

/**
 * Alta, edición (nombre y modo) o cambio de contraseña de un validador de identidad. Se monta
 * con `key` por diálogo: cada apertura empieza con el formulario limpio.
 */
export function ValidatorModal({ dialog, onClose, onSaved }: ValidatorModalProps) {
  const feedback = useFeedback();
  const form = useValidatorForm(dialog);
  const { values, asks, shown, touch, set } = form;
  const copy = COPY[dialog.kind];
  const [saving, setSaving] = useState(false);
  const canSubmit = form.valid && !saving;

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await persist(dialog, values);
      const [title, detail] = copy.done(saved);
      feedback.success(title, detail);
      onSaved(saved);
      onClose();
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') form.setEmailTaken(err.message);
      void feedback.fromError(err, { title: copy.failed });
    }
  };

  return (
    <Modal
      open
      title={copy.title}
      icon={<copy.Icon size={30} />}
      eyebrow={form.current?.name ?? 'Validador de identidad'}
      wide={dialog.kind !== 'password'}
      onClose={() => !saving && onClose()}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" icon={<copy.Icon size={18} />} loading={saving} disabled={!canSubmit} data-primary="" onClick={() => void submit()}>
            {copy.action}
          </Button>
        </>
      }
    >
      <div className="stack">
        {dialog.kind === 'password' && (
          <p className="muted">Asigna una contraseña nueva y compártela por un medio seguro. Se cerrarán sus sesiones abiertas.</p>
        )}
        {asks.name && (
          <FormField
            label="Nombre o ubicación"
            icon={<MapPin size={18} />}
            required
            maxLength={NAME_MAX}
            value={values.name}
            error={shown('name')}
            hint="Así lo verás en la bitácora: p. ej. “Recepción planta 1”"
            onBlur={() => touch('name')}
            onChange={(e) => set('name', e.target.value)}
          />
        )}
        {asks.email && (
          <FormField
            label="Correo de acceso"
            icon={<Mail size={18} />}
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={values.email}
            error={shown('email')}
            hint="Con este correo iniciará sesión en la tableta o el teléfono"
            onBlur={() => touch('email')}
            onChange={(e) => set('email', e.target.value)}
          />
        )}
        {asks.password && (
          <FormField
            label={dialog.kind === 'create' ? 'Contraseña inicial' : 'Contraseña nueva'}
            icon={<KeyRound size={18} />}
            type="password"
            autoComplete="new-password"
            required
            value={values.password}
            error={shown('password')}
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
            onBlur={() => touch('password')}
            onChange={(e) => set('password', e.target.value)}
          />
        )}
        {asks.name && <ValidatorModePicker value={values.mode} onChange={(mode) => set('mode', mode)} disabled={saving} />}
      </div>
    </Modal>
  );
}
