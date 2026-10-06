import { Tablet } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { createKioskConfirm } from '../../../components/kiosks/kioskConfirms';
import { kioskPairingMessage } from '../../../components/kiosks/kioskPairing';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useSubmit } from '../../../hooks/useAction';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { siteService } from '../../../services/siteService';

/** Largo máximo del nombre (el backend acepta de 1 a 80). */
export const KIOSK_NAME_MAX = 80;

const siteError = () => t('sites.form.loadError');

/**
 * Nuevo kiosco de un sitio (/company/sites/:id/kiosks/new): solo su nombre ("Entrada principal"). Se confirma antes de
 * crearlo y, al terminar, el popup muestra UNA vez el código de vinculación (y su QR) para la tableta del sitio.
 */
export function KioskFormPage() {
  const t = useT();
  const siteId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: site } = useResource((signal) => siteService.get(siteId, signal), siteId, siteError);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const { saving, submit: send } = useSubmit();
  const back = () => void navigate(paths.company.siteKiosks(siteId));
  const nameError = serverError ?? (touched && !name.trim() ? t('kiosk.manage.nameRequired') : undefined);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || saving) return;
    await send(
      async () => {
        const created = await siteService.createKiosk(siteId, name);
        back();
        void feedback.show(() => kioskPairingMessage(created));
      },
      () => t('kiosk.manage.createError'),
      { confirm: () => createKioskConfirm(name.trim(), site?.name ?? ''), onError: (error) => setServerError(fieldErrorsFrom<{ name: string }>(error).name) },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(event) => void submit(event)}>
        <PanelHeader title={t('kiosk.manage.newTitle')} subtitle={site?.name ?? t('common.states.loading')} backTo={paths.company.siteKiosks(siteId)} backLabel={t('kiosk.manage.title')} />
        <PanelSection title={t('kiosk.manage.kiosk')} icon={<Tablet size={20} />}>
          <FormField
            label={t('common.fields.name')}
            icon={<Tablet size={18} />}
            placeholder={t('kiosk.manage.namePlaceholder')}
            value={name}
            maxLength={KIOSK_NAME_MAX}
            required
            disabled={saving}
            error={nameError}
            hint={t('kiosk.manage.nameHint')}
            onChange={(e) => {
              setName(e.target.value);
              setServerError(undefined);
            }}
            onBlur={() => setTouched(true)}
          />
        </PanelSection>
        <FormFooter submitLabel={t('kiosk.manage.create')} submitIcon={<Tablet size={18} />} saving={saving} onCancel={back} />
      </Panel>
    </div>
  );
}
