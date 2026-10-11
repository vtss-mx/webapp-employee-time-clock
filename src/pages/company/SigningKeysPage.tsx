import { Plus, ShieldCheck, Signature } from 'lucide-react';
import { revokeSigningKeyConfirm } from '../../components/integrations/signingKeyMessages';
import { PlatformKeyPanel, SigningKeyRow } from '../../components/integrations/signingKeyParts';
import { ButtonLink } from '../../components/ui/Button';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { signingKeyService } from '../../services/signingKeyService';
import type { PlatformKey, SigningKey, SigningKeyLimits } from '../../types';
import { rotatePath } from '../../utils/signingKeys';

/** Lo que el listado trae además de los elementos (regla 25: ningún número de estos vive en la app). */
type Extra = { platform: PlatformKey; limits: SigningKeyLimits };

/** Avisos armados al dibujarse: el popup abierto sigue al idioma activo. */
const loadError = () => t('signingKeys.list.loadError');
const revokeError = () => t('signingKeys.revoke.error');
const revokedNotice = (key: SigningKey): SuccessNotice => [t('signingKeys.revoke.done'), t('signingKeys.revoke.doneText', { name: key.label })];

/**
 * Claves de FIRMA de la empresa (sección de la pantalla «Integraciones (API)», migración 0105 del backend):
 * la clave PÚBLICA con que la empresa firma cada petición de la API —su clave privada nunca toca el servidor— y la
 * clave pública con que la PLATAFORMA firma lo que responde.
 *
 * Administrar estas claves NO se puede hacer con una llave de la API (sería escalada de privilegios, regla 24 de
 * la raíz): todo va con la sesión de una cuenta de la empresa.
 *
 * Nada se calcula aquí: el estado de cada clave, los días que le quedan, el aviso de que vence pronto, el tope de
 * claves vigentes y los días de gracia al rotar los envía el servidor (regla 25).
 */
export function SigningKeysPage() {
  const t = useT();
  const list = usePagedList<SigningKey, Extra>((page, signal) => signingKeyService.list(page, signal), { errorTitle: loadError });
  const action = useAction<number>();
  const limits = list.data?.limits ?? null;
  // Al tope, registrar otra clave (también al rotar) responde 409: la salida es revocar una, no reintentar.
  const full = limits !== null && limits.active >= limits.max_active;

  const revoke = (key: SigningKey) =>
    void action.run(() => signingKeyService.revoke(key.id), {
      busy: key.id,
      confirm: () => revokeSigningKeyConfirm(key),
      errorTitle: revokeError,
      success: () => revokedNotice(key),
      onSuccess: list.retry,
      // 404: alguien más la revocó o venció mientras se miraba la lista. El motivo lo explica el popup del
      // servidor y la lista se vuelve a pedir, para que deje de ofrecer una clave que ya no está.
      onError: (error) => error instanceof ApiError && error.status === 404 && list.retry(),
    });

  const addButton = (
    <ButtonLink to={paths.company.newSigningKey} variant="primary" icon={<Plus size={18} />}>
      {t('signingKeys.list.add')}
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('signingKeys.list.title')}
          subtitle={t('signingKeys.list.subtitle')}
          backTo={paths.company.integrations}
          backLabel={t('signingKeys.list.back')}
          actions={full ? undefined : addButton}
        />
        <PanelSection>
          {limits && (
            <p className="muted small">
              {t('signingKeys.list.active', { active: limits.active, max: limits.max_active })}
              {full ? ` · ${t('signingKeys.list.full')}` : ''}
            </p>
          )}
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <Signature />,
              title: t('signingKeys.list.empty.title'),
              description: t('signingKeys.list.empty.description'),
              action: addButton,
            }}
            pager={{ noun: { one: t('signingKeys.list.noun.one'), other: t('signingKeys.list.noun.other') } }}
          >
            {(keys) => (
              <ul className={`validator-list stagger ${list.loading ? 'is-loading' : ''}`}>
                {keys.map((key) => (
                  <SigningKeyRow key={key.id} item={key} rotateTo={rotatePath(key.id)} full={full} busy={action.busy} onRevoke={revoke} />
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelSection title={t('signingKeys.platform.title')} icon={<ShieldCheck size={20} />}>
          {list.data && <PlatformKeyPanel platform={list.data.platform} />}
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('signingKeys.list.footer')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
