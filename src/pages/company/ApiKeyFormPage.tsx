import { CalendarClock, History, KeyRound, ScanFace, ScanLine, ShieldCheck, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
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
import { t, useT, type MessageKey } from '../../i18n';
import { paths } from '../../routes/paths';
import { apiKeyService } from '../../services/apiKeyService';
import { ApiError } from '../../services/apiClient';
import type { ApiScope } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

/** Ícono de cada permiso; los permisos (código, nombre y qué permiten) vienen del catálogo api_scopes. */
const SCOPE_ICONS: Partial<Record<string, LucideIcon>> = {
  EMPLOYEES_READ: Users,
  ATTENDANCE_READ: History,
  VALIDATORS_READ: ScanLine,
  VERIFICATION: ScanFace,
};

/** El permiso de la verificación facial desde la aplicación móvil de la empresa (SDK): su llave irá dentro de la app. */
const VERIFICATION_SCOPE: ApiScope = 'VERIFICATION';

/**
 * Aviso al marcar «Verificación»: una llave dentro de una aplicación se puede extraer. Con otros permisos, pide separarla
 * (una llave SOLO con ese permiso para la app y otra para el servidor).
 */
function VerificationWarning({ mixed }: { mixed: boolean }) {
  const t = useT();
  return (
    <div className="callout" role="note">
      <span className="icon-tile icon-tile--warning">
        <TriangleAlert size={22} />
      </span>
      <div className="callout__body">
        <strong>{t('apiKeys.form.verificationWarning.title')}</strong>
        <p className="muted small">{t(mixed ? 'apiKeys.form.verificationWarning.mixed' : 'apiKeys.form.verificationWarning.message')}</p>
      </div>
    </div>
  );
}

/** Vigencias que se ofrecen (el backend acepta de 1 a 730 días o sin vencimiento) y el texto de cada una. */
const LIFETIMES = {
  '30': 'apiKeys.form.lifetimes.days30',
  '90': 'apiKeys.form.lifetimes.days90',
  '180': 'apiKeys.form.lifetimes.months6',
  '365': 'apiKeys.form.lifetimes.year1',
  never: 'apiKeys.form.lifetimes.never',
} as const satisfies Record<string, MessageKey>;
type Lifetime = keyof typeof LIFETIMES;

/** Opciones de la vigencia en el idioma activo. */
const lifetimeOptions = () =>
  (Object.keys(LIFETIMES) as Lifetime[]).map((value) => ({
    value,
    label: t(LIFETIMES[value]),
    ...(value === 'never' ? { description: t('apiKeys.form.lifetimes.neverHint') } : {}),
  }));

/** Título del popup si no se pudo crear: el tope de llaves se explica aparte. */
const createError = (error: unknown) => t(error instanceof ApiError && error.code === 'API_KEY_LIMIT' ? 'apiKeys.form.limitError' : 'apiKeys.form.error');

/** Antes de crearla: qué se creará (nombre, permisos y vigencia) y que el secreto se ve una sola vez. */
function createConfirm(name: string, scopeNames: string[], lifetime: Lifetime): ConfirmInput {
  return {
    kind: 'create',
    icon: <KeyRound size={30} />,
    title: t('apiKeys.form.confirm.title', { name }),
    message: t('apiKeys.form.confirm.message'),
    detailsTitle: t('apiKeys.form.confirm.detailsTitle'),
    details: [
      { label: t('common.fields.name'), value: name },
      { label: t('apiKeys.form.scopes'), value: scopeNames.join(', ') },
      { label: t('apiKeys.form.lifetime'), value: t(LIFETIMES[lifetime]) },
    ],
    note: t('apiKeys.form.confirm.note'),
    confirmLabel: t('apiKeys.form.submit'),
    confirmIcon: <KeyRound size={18} />,
  };
}

/**
 * Crear una llave de la API (/company/integrations/new): nombre del sistema que se conecta, sus
 * permisos de lectura y su vigencia. El secreto se muestra una sola vez al terminar.
 */
export function ApiKeyFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { active } = useCatalogs();
  const lifetimeId = useId();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [lifetime, setLifetime] = useState<Lifetime>('365');
  const [touched, setTouched] = useState(false);
  const { saving, submit: send } = useSubmit();

  const nameError = touched && !name.trim() ? t('apiKeys.form.nameRequired') : undefined;
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
        void feedback.show(() => apiKeySecretMessage(created));
      },
      createError,
      {
        // Pregunta antes de crearla; cancelar deja el formulario como estaba.
        confirm: () => createConfirm(name.trim(), active('api_scopes').filter((scope) => scopes.includes(scope.code)).map((scope) => scope.name), lifetime),
      },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader
          title={t('apiKeys.form.title')}
          subtitle={t('apiKeys.form.subtitle')}
          backTo={paths.company.integrations}
          backLabel={t('apiKeys.form.back')}
        />
        <PanelSection title={t('apiKeys.form.system')} icon={<KeyRound size={20} />}>
          <FormField
            label={t('common.fields.name')}
            placeholder={t('apiKeys.form.namePlaceholder')}
            value={name}
            maxLength={80}
            required
            error={nameError}
            hint={t('apiKeys.form.nameHint')}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </PanelSection>
        <PanelSection title={t('apiKeys.form.scopes')} icon={<ShieldCheck size={20} />}>
          <p className="muted small">{t('apiKeys.form.scopesIntro')}</p>
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
          {scopes.includes(VERIFICATION_SCOPE) && <VerificationWarning mixed={scopes.length > 1} />}
          {touched && scopes.length === 0 && <p className="field__error">{t('apiKeys.form.scopesRequired')}</p>}
        </PanelSection>
        <PanelSection title={t('apiKeys.form.lifetime')} icon={<CalendarClock size={20} />}>
          <div className="field">
            <FieldLabel htmlFor={lifetimeId} label={t('apiKeys.form.expiresIn')} />
            <Select id={lifetimeId} value={lifetime} options={lifetimeOptions()} onChange={setLifetime} />
          </div>
          <p className="muted small">{t('apiKeys.form.lifetimeNote')}</p>
        </PanelSection>
        <FormFooter
          submitLabel={t('apiKeys.form.submit')}
          submitIcon={<KeyRound size={18} />}
          saving={saving}
          disabled={touched && !ready}
          disabledTitle={t('apiKeys.form.incomplete')}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
