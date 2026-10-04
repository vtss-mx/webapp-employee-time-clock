import { CalendarClock, History, KeyRound, ScanLine, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { useId, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldLabel, FormField } from '../../components/FormField';
import { FormFooter } from '../../components/FormFooter';
import { apiKeySecretMessage } from '../../components/integrations/apiKeySecret';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { useSubmit } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { paths } from '../../routes/paths';
import { apiKeyService } from '../../services/apiKeyService';
import { ApiError } from '../../services/apiClient';
import type { ApiScope } from '../../types';

/** Ícono de cada permiso; los permisos (código, nombre y qué permiten) vienen del catálogo api_scopes. */
const SCOPE_ICONS: Partial<Record<string, LucideIcon>> = { EMPLOYEES_READ: Users, ATTENDANCE_READ: History, VALIDATORS_READ: ScanLine };

/** Vigencias que se ofrecen (el backend acepta de 1 a 730 días o sin vencimiento). */
const LIFETIMES = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 año' },
  { value: 'never', label: 'Sin vencimiento', description: 'Solo si el sistema no puede rotarla: revócala si deja de usarse.' },
];

/**
 * Crear una llave de la API (/company/integrations/new): nombre del sistema que se conecta, sus
 * permisos de lectura y su vigencia. El secreto se muestra una sola vez al terminar.
 */
export function ApiKeyFormPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { active } = useCatalogs();
  const lifetimeId = useId();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [lifetime, setLifetime] = useState('365');
  const [touched, setTouched] = useState(false);
  const { saving, submit: send } = useSubmit();

  const nameError = touched && !name.trim() ? 'Escribe para qué sistema es la llave' : undefined;
  const ready = Boolean(name.trim()) && scopes.length > 0;
  const toggle = (scope: ApiScope, on: boolean) => setScopes((current) => (on ? [...current, scope] : current.filter((s) => s !== scope)));
  const back = () => void navigate(paths.company.integrations);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!ready || saving) return;
    await send(
      async () => {
        const created = await apiKeyService.create({ name, scopes, expires_in_days: lifetime === 'never' ? null : Number(lifetime) });
        back();
        void feedback.show(apiKeySecretMessage(created));
      },
      (error) => (error instanceof ApiError && error.code === 'API_KEY_LIMIT' ? 'Llegaste al tope de llaves' : 'No se pudo crear la llave'),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader
          title="Crear llave de la API"
          subtitle="Una llave por cada sistema que se conecta: así puedes revocar uno sin afectar a los demás."
          backTo={paths.company.integrations}
          backLabel="Integraciones"
        />
        <PanelSection title="Sistema que se conecta" icon={<KeyRound size={20} />}>
          <FormField
            label="Nombre"
            placeholder="Nómina, ERP, control de acceso…"
            value={name}
            maxLength={80}
            required
            error={nameError}
            hint="Para reconocerla en la lista y en la bitácora de uso."
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </PanelSection>
        <PanelSection title="Permisos (solo lectura)" icon={<ShieldCheck size={20} />}>
          <p className="muted small">Elige solo lo que el sistema necesita. Ninguna llave puede modificar datos ni ver fotos o datos biométricos.</p>
          {active('api_scopes').map((scope) => {
            const Icon = SCOPE_ICONS[scope.code] ?? KeyRound;
            return (
              <Switch
                key={scope.code}
                icon={<Icon size={20} />}
                label={scope.name}
                description={scope.description ?? undefined}
                checked={scopes.includes(scope.code)}
                onChange={(on) => toggle(scope.code, on)}
              />
            );
          })}
          {touched && scopes.length === 0 && <p className="field__error">Elige al menos un permiso.</p>}
        </PanelSection>
        <PanelSection title="Vigencia" icon={<CalendarClock size={20} />}>
          <div className="field">
            <FieldLabel htmlFor={lifetimeId} label="Vence en" />
            <Select id={lifetimeId} value={lifetime} options={LIFETIMES} onChange={setLifetime} />
          </div>
          <p className="muted small">Al vencer deja de funcionar; antes puedes rotarla para obtener una nueva con los mismos permisos.</p>
        </PanelSection>
        <FormFooter
          submitLabel="Crear llave"
          submitIcon={<KeyRound size={18} />}
          saving={saving}
          disabled={touched && !ready}
          disabledTitle="Escribe el nombre y elige al menos un permiso"
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
