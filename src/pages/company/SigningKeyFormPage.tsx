import { KeyRound, Signature } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormField } from '../../components/FormField';
import { FormFooter } from '../../components/FormFooter';
import { LifetimeSection, PublicKeySection, ReplacesSection, SourceSection, type SigningKeySource } from '../../components/integrations/signingKeyFields';
import { signingKeyConfirm, signingKeyPrivateMessage } from '../../components/integrations/signingKeyMessages';
import type { MessageSource } from '../../components/MessageDialog';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { ResourceFallback } from '../../components/ui/ResourceFallback';
import { useFeedback } from '../../hooks/useFeedback';
import { useLoadValues } from '../../hooks/useLoadValues';
import { useResource } from '../../hooks/useResource';
import { useSubmit } from '../../hooks/useAction';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError, fieldErrorsFrom } from '../../services/apiClient';
import { signingKeyService } from '../../services/signingKeyService';
import type { SigningKey, SigningKeyGenerated } from '../../types';
import { config } from '../../utils/config';
import {
  lifetimeLabel,
  missingSigningKeyFields,
  NO_REPLACES,
  replaceable,
  replacedKey,
  replacesFrom,
  REPLACES_PARAM,
  signingKeyPayload,
  signingKeyReady,
  SIGNING_KEY_FIELD_ERRORS,
  type SigningKeyFormFields,
} from '../../utils/signingKeys';

/** Las claves que se pueden reemplazar caben de sobra en una página: el tope de vigentes lo pone el servidor. */
const PAGE = { page: 1, size: Math.max(...config.pageSizes) };
const EMPTY: SigningKeyFormFields = { label: '', public_key: '', expires_in_days: '', replaces: NO_REPLACES };

/** Avisos armados al dibujarse: el popup abierto sigue al idioma activo. */
const loadError = () => t('signingKeys.form.loadError');

/** Título del popup si no se pudo guardar: el tope y la clave repetida se explican por su nombre. */
const submitError = (source: SigningKeySource) => (error: unknown) => {
  if (error instanceof ApiError && error.code === 'SIGNING_KEY_LIMIT') return t('signingKeys.form.limitError');
  if (error instanceof ApiError && error.code === 'SIGNING_KEY_DUPLICATE') return t('signingKeys.form.duplicateError');
  return t(source === 'platform' ? 'signingKeys.form.generateError' : 'signingKeys.form.error');
};

/** Registrar la clave pública de la empresa o pedir el par a la plataforma: el mismo cuerpo, dos rutas. */
function create(values: SigningKeyFormFields, generate: boolean): Promise<SigningKey | SigningKeyGenerated> {
  const payload = signingKeyPayload(values);
  return generate ? signingKeyService.generate(payload) : signingKeyService.register({ ...payload, public_key: values.public_key.trim() });
}

/**
 * Lo que se muestra al terminar: la clave PRIVADA una sola vez (si la plataforma generó el par) o el aviso de que
 * la clave quedó registrada. Nunca los dos: un resultado, un popup.
 */
function resultOf(created: SigningKey | SigningKeyGenerated): MessageSource {
  if ('private_key' in created) return () => signingKeyPrivateMessage(created);
  return () => ({ variant: 'success', title: t('signingKeys.form.done'), text: t('signingKeys.form.doneText', { name: created.label }) });
}

/**
 * Agregar una clave de firma (`/company/integrations/signing-keys/new`): la empresa registra SU clave pública —el
 * camino recomendado, porque su clave privada no toca nunca nuestro servidor— o pide que la plataforma genere el
 * par y entregue la privada UNA sola vez (que no se guarda en ningún lado, ni aquí ni en el servidor).
 *
 * Con `?replaces=<id>` es una ROTACIÓN: la clave que se reemplaza no muere al instante, sigue firmando los días de
 * gracia que decide el servidor. Revocar, en cambio, es inmediato y vive en la lista.
 *
 * Ningún número de esta pantalla está escrito en la app (regla 25 de la raíz): la vigencia por omisión, su tope y
 * los días de gracia llegan en `limits` del listado.
 */
export function SigningKeyFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [params] = useSearchParams();
  const resource = useResource((signal) => signingKeyService.list(PAGE, signal), 'signing-keys', loadError);
  const [source, setSource] = useState<SigningKeySource>('own');
  const [values, setValues] = useState<SigningKeyFormFields>(EMPTY);
  const [failed, setFailed] = useState<Partial<SigningKeyFormFields>>({});
  const [touched, setTouched] = useState(false);
  const { saving, submit: send } = useSubmit();

  const keys = resource.data?.items ?? [];
  const options = replaceable(keys);
  // La vigencia por omisión y la clave que `?replaces=` pide salen del SERVIDOR; se cargan sin pisar lo escrito.
  useLoadValues(
    resource.data && { expires_in_days: String(resource.data.limits.default_days), replaces: replacesFrom(params.get(REPLACES_PARAM), keys) },
    (loaded) => setValues((current) => ({ ...current, ...loaded })),
  );

  const back = () => void navigate(paths.company.signingKeys);
  const change = (field: keyof SigningKeyFormFields, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Se quita la llave (no se pone en `undefined`): así lo que falta por llenar vuelve a verse si aplica.
    setFailed(({ [field]: _removed, ...rest }) => rest);
  };

  if (!resource.data) {
    return (
      <ResourceFallback
        error={resource.error}
        retry={resource.retry}
        header={{ title: t('signingKeys.form.title'), backTo: paths.company.signingKeys, backLabel: t('signingKeys.form.back') }}
      />
    );
  }

  const { limits } = resource.data;
  const generate = source === 'platform';
  const ready = signingKeyReady(values, generate);
  const replaced = replacedKey(options, values.replaces);
  // El error del servidor gana sobre lo que falta por llenar: es más preciso.
  const errors = { ...missingSigningKeyFields(values, generate, touched), ...failed };

  const save = async () => {
    const created = await create(values, generate);
    back();
    void feedback.show(resultOf(created));
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!ready || saving) return;
    await send(save, submitError(source), {
      confirm: () =>
        signingKeyConfirm({
          name: values.label.trim(),
          generate,
          lifetime: lifetimeLabel(values.expires_in_days, limits),
          replaces: replaced?.label ?? null,
          graceDays: limits.grace_days,
        }),
      onError: (error) => setFailed(fieldErrorsFrom<SigningKeyFormFields>(error, SIGNING_KEY_FIELD_ERRORS)),
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader
          title={t(replaced ? 'signingKeys.form.rotateTitle' : 'signingKeys.form.title')}
          subtitle={t('signingKeys.form.subtitle')}
          backTo={paths.company.signingKeys}
          backLabel={t('signingKeys.form.back')}
        />
        <PanelSection title={t('signingKeys.form.system')} icon={<Signature size={20} />}>
          <FormField
            label={t('common.fields.name')}
            placeholder={t('signingKeys.form.namePlaceholder')}
            value={values.label}
            maxLength={80}
            required
            error={errors.label}
            hint={t('signingKeys.form.nameHint')}
            onChange={(e) => change('label', e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </PanelSection>
        <SourceSection value={source} onChange={setSource} />
        {!generate && (
          <PublicKeySection
            value={values.public_key}
            error={errors.public_key}
            onChange={(value) => change('public_key', value)}
            onFileError={() => setFailed((current) => ({ ...current, public_key: t('signingKeys.form.fileError') }))}
          />
        )}
        <LifetimeSection value={values.expires_in_days} error={errors.expires_in_days} limits={limits} onChange={(value) => change('expires_in_days', value)} />
        {options.length > 0 && (
          <ReplacesSection value={values.replaces} error={errors.replaces} options={options} graceDays={limits.grace_days} onChange={(value) => change('replaces', value)} />
        )}
        <FormFooter
          submitLabel={t(generate ? 'signingKeys.form.submitGenerate' : 'signingKeys.form.submit')}
          submitIcon={generate ? <KeyRound size={18} /> : <Signature size={18} />}
          saving={saving}
          disabled={touched && !ready}
          disabledTitle={t(generate ? 'signingKeys.form.incompleteName' : 'signingKeys.form.incomplete')}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
