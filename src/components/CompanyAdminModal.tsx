import { KeyRound, UserCog, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAvailability } from '../hooks/useAvailability';
import { useFeedback } from '../hooks/useFeedback';
import { ApiError } from '../services/apiClient';
import { adminService } from '../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';
import { FormField, liveFeedback } from './FormField';
import { Modal } from './Modal';
import { Button } from './ui/Button';

interface CompanyAdminModalProps {
  open: boolean;
  company: CompanyDetail;
  /** Con un administrador: restablecer su contraseña. Sin él: agregar otro administrador. */
  admin?: CompanyAdmin | null;
  onClose: () => void;
  onSaved: (company: CompanyDetail) => void;
}

/** Textos de cada modo (agregar uno nuevo o restablecer la contraseña de uno existente). */
const MODES = {
  add: { title: 'Agregar administrador', Icon: UserPlus, action: 'Agregar', password: 'Contraseña inicial', failed: 'No se pudo agregar el administrador' },
  reset: { title: 'Restablecer contraseña', Icon: KeyRound, action: 'Restablecer', password: 'Contraseña nueva', failed: 'No se pudo restablecer la contraseña' },
} as const;

/**
 * Administradores de una empresa (consola de la plataforma): agregar uno nuevo (correo único y
 * contraseña inicial) o restablecer la contraseña de uno existente (cierra sus sesiones).
 */
export function CompanyAdminModal({ open, company, admin, onClose, onSaved }: CompanyAdminModalProps) {
  const feedback = useFeedback();
  const isReset = Boolean(admin);
  const mode = isReset ? MODES.reset : MODES.add;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [serverError, setServerError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const live = liveFeedback(
    useAvailability('company_admin_email', email, {
      enabled: open && !isReset && !validateEmail(email),
      check: (value) => adminService.availability('admin_email', value),
    }),
  );
  const emailError = serverError ?? (touched.email ? validateEmail(email) : undefined) ?? live.error;
  const passwordError = touched.password ? validatePassword(password) : undefined;
  const emailReady = isReset || (!validateEmail(email) && !live.error && live.status?.tone !== 'checking');
  const canSubmit = emailReady && !validatePassword(password) && !saving;

  const close = () => {
    if (saving) return;
    setEmail('');
    setPassword('');
    setTouched({ email: false, password: false });
    setServerError(undefined);
    onClose();
  };

  const submit = async () => {
    setSaving(true);
    try {
      const updated = admin
        ? await adminService.resetAdminPassword(company.id, admin.id, password)
        : await adminService.addAdmin(company.id, email, password);
      if (admin) feedback.success('Contraseña restablecida', `${admin.email} ya puede entrar con la nueva contraseña. Sus sesiones abiertas se cerraron.`);
      else feedback.success('Administrador agregado', `${email.trim().toLowerCase()} ya puede iniciar sesión.`);
      onSaved(updated);
      setSaving(false);
      close();
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setServerError(err.message);
      void feedback.fromError(err, { title: mode.failed });
    }
  };

  return (
    <Modal
      open={open}
      title={mode.title}
      icon={<mode.Icon size={30} />}
      eyebrow={admin?.email ?? company.name}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<mode.Icon size={18} />}
            loading={saving}
            disabled={!canSubmit}
            title={canSubmit ? undefined : 'Completa correctamente todos los campos obligatorios'}
            data-primary=""
            onClick={() => void submit()}
          >
            {mode.action}
          </Button>
        </>
      }
    >
      <div className="stack">
        {isReset ? (
          <p className="muted">Asigna una contraseña nueva y compártela por un medio seguro. Se cerrarán sus sesiones abiertas.</p>
        ) : (
          <FormField
            label="Correo del administrador"
            icon={<UserCog size={18} />}
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={email}
            error={emailError}
            status={live.status}
            hint="Con este correo iniciará sesión"
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            onChange={(e) => {
              setEmail(e.target.value);
              setServerError(undefined);
            }}
          />
        )}
        <FormField
          label={mode.password}
          icon={<KeyRound size={18} />}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          error={passwordError}
          hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </Modal>
  );
}
