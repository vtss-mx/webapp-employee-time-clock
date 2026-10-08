import { KeyRound, Pencil, Plus } from 'lucide-react';
import { useEffect, useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { FormFooter } from '../components/FormFooter';
import { PageLoader } from '../components/Spinner';
import { Panel, PanelHeader, PanelSection } from '../components/ui/Panel';
import { useAction } from '../hooks/useAction';
import { useFeedback } from '../hooks/useFeedback';
import { useLoadValues } from '../hooks/useLoadValues';
import { useResource } from '../hooks/useResource';
import { t, useT } from '../i18n';
import { paths } from '../routes/paths';
import { passkeyService } from '../services/passkeyService';
import type { ConfirmInput } from '../types/confirm';
import type { Passkey, PasskeyList } from '../types/passkeys';
import { config } from '../utils/config';
import { describeDevice } from '../utils/userAgent';
import { createPasskey } from '../utils/webauthn';

/** Largo máximo del nombre (el mismo que el servidor). */
export const PASSKEY_NAME_MAX = 60;

/** Qué le falta al nombre (en el idioma activo: se calcula al dibujarse). */
export function validatePasskeyName(name: string): string | undefined {
  const clean = name.trim();
  if (!clean) return t('passkeys.form.nameRequired');
  return clean.length > PASSKEY_NAME_MAX ? t('passkeys.form.nameTooLong', { max: PASSKEY_NAME_MAX }) : undefined;
}

function createConfirm(name: string): ConfirmInput {
  return {
    kind: 'create',
    icon: <KeyRound size={30} />,
    eyebrow: t('passkeys.form.createAsk.eyebrow'),
    title: t('passkeys.form.createAsk.title'),
    message: t('passkeys.form.createAsk.message'),
    details: [{ label: t('passkeys.form.name'), value: name }],
    note: t('passkeys.form.createAsk.note'),
    confirmLabel: t('passkeys.form.createAsk.confirm'),
    confirmIcon: <KeyRound size={18} />,
  };
}

function renameConfirm(before: string, after: string): ConfirmInput {
  return {
    kind: 'edit',
    icon: <Pencil size={30} />,
    eyebrow: t('passkeys.form.createAsk.eyebrow'),
    title: t('passkeys.form.renameAsk.title'),
    changes: [{ label: t('passkeys.form.name'), before, after }],
  };
}

const registerError = () => t('passkeys.form.registerFailed');
const renameError = () => t('passkeys.form.renameFailed');
const loadError = () => t('passkeys.loadError');
/** Las llaves de la cuenta caben en una página (el servidor admite hasta 10 por cuenta). */
const PAGE_SIZE = config.pageSizes[config.pageSizes.length - 1];

/**
 * La llave que se renombra: la que trajo la sección de Mi perfil (`location.state`) o, si la URL se escribió a mano o
 * se recargó, la que el servidor lista con ese id (una consulta; `null` mientras llega). `found: false` cuando el
 * servidor ya respondió y la llave no es de esta cuenta: no hay qué renombrar.
 */
function useRenamedPasskey(id: string | undefined, fromState: Passkey | null): { passkey: Passkey | null; found: boolean } {
  const lookup = id !== undefined && fromState === null;
  const list = useResource<PasskeyList | null>(
    (signal) => (lookup ? passkeyService.list({ page: 1, size: PAGE_SIZE }, signal) : Promise.resolve(null)),
    `${id ?? ''}:${String(lookup)}`,
    loadError,
  );
  if (!lookup) return { passkey: fromState, found: true };
  const passkey = list.data?.items.find((item) => item.id === Number(id)) ?? null;
  return { passkey, found: list.data === null || passkey !== null };
}

/**
 * Registrar una llave de acceso en este dispositivo (`/profile/passkeys/new`) o renombrar una (`/profile/passkeys/:id/
 * rename`; sin la llave se vuelve a Mi perfil). Todo formulario es una pantalla: nombre de la llave, confirmación antes
 * de enviar y, al registrar, la ceremonia del navegador (el aviso del sistema pide el rostro, la huella o el PIN).
 * Cancelar el aviso del sistema no es una falla: no avisa nada y el formulario sigue.
 */
export function PasskeyFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const fromState = (useLocation().state as { passkey?: Passkey } | null)?.passkey ?? null;
  const renaming = id !== undefined;
  const { passkey: existing, found } = useRenamedPasskey(id, fromState);
  const [name, setName] = useState(renaming ? '' : describeDevice(navigator.userAgent).label);
  const [touched, setTouched] = useState(false);
  const feedback = useFeedback();
  // `useAction` y no `useSubmit`: cancelar el aviso del sistema deja el formulario disponible (no «guardando»).
  const { busy, run } = useAction();
  const saving = busy !== null;
  // El nombre actual se carga por valor (volver a pedir la llave al cambiar de idioma no pisa lo escrito).
  useLoadValues(existing ? { name: existing.name } : null, (values) => setName(values.name));

  // Renombrar una llave que no es de esta cuenta (la URL escrita a mano): no hay qué renombrar.
  useEffect(() => {
    if (!found) void navigate(paths.profile, { replace: true });
  }, [found, navigate]);

  const error = validatePasskeyName(name);
  const back = () => void navigate(paths.profile);

  const register = async () => {
    const options = await passkeyService.registrationOptions();
    const credential = await createPasskey(options.options);
    if (!credential) return; // la persona canceló el aviso del sistema: nada que avisar
    await passkeyService.register({ token: options.token, name: name.trim(), credential });
    void feedback.success(() => t('passkeys.form.registered'), () => t('passkeys.form.registeredText'));
    back();
  };

  const rename = async (passkey: Passkey) => {
    await passkeyService.rename(passkey.id, name.trim());
    void feedback.success(() => t('passkeys.form.renamed'));
    back();
  };

  // Con un nombre inválido el botón de enviar está deshabilitado (y el navegador no envía el formulario con Enter):
  // aquí el nombre ya es válido.
  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (existing && existing.name === name.trim()) {
      void feedback.info(() => t('passkeys.form.noChanges'));
      return;
    }
    // Al renombrar, la llave ya está (sin ella no se dibuja el formulario); sin llave se registra una nueva.
    await run(existing ? () => rename(existing) : register, {
      errorTitle: existing ? renameError : registerError,
      confirm: () => (existing ? renameConfirm(existing.name, name.trim()) : createConfirm(name.trim())),
    });
  };

  if (renaming && !existing) return found ? <PageLoader /> : null;

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader
          title={t(renaming ? 'passkeys.form.renameTitle' : 'passkeys.form.newTitle')}
          subtitle={t(renaming ? 'passkeys.form.renameSubtitle' : 'passkeys.form.newSubtitle')}
          backTo={paths.profile}
          backLabel={t('passkeys.form.back')}
        />
        <PanelSection title={t('passkeys.form.section')} icon={<KeyRound size={20} />}>
          {!renaming && <p className="muted">{t('passkeys.form.intro')}</p>}
          <div className="form-grid">
            <FormField
              label={t('passkeys.form.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched ? error : undefined}
              hint={t('passkeys.form.nameHint')}
              maxLength={PASSKEY_NAME_MAX + 20}
              icon={<KeyRound size={18} />}
              disabled={saving}
              required
              autoFocus
            />
          </div>
        </PanelSection>
        <FormFooter
          submitLabel={t(renaming ? 'passkeys.form.renameSubmit' : 'passkeys.form.submit')}
          submitIcon={renaming ? <Pencil size={18} /> : <Plus size={18} />}
          saving={saving}
          disabled={Boolean(error)}
          disabledTitle={error}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
