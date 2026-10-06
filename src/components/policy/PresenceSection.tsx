import { FileSignature, LocateFixed, MapPinCheck, QrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import type { AdminVerificationPolicy } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { TuningRow, type Tuning, type TuningSave } from '../settings/PolicyTuning';
import { PanelSection } from '../ui/Panel';
import { PRESENCE_FIELDS } from './policyFields';

type PresenceField = keyof typeof PRESENCE_FIELDS;

const ICONS: Record<PresenceField, ReactNode> = {
  validator_signing: <FileSignature size={20} />,
  validator_location: <LocateFixed size={20} />,
  site_codes: <QrCode size={20} />,
};

/**
 * Un control de presencia: elige un modo del catálogo `signal_modes` (apagado, solo medir u obligatorio; mayor
 * `sort_order`, más estricto). Se muestran solo los NOMBRES del catálogo: sus descripciones hablan de los puntos de las
 * señales; la ayuda de cada control es la propia del diccionario. Exigirlo advierte qué preparar antes.
 */
function presenceTuning(policy: AdminVerificationPolicy, field: PresenceField, { active, nameOf }: Pick<CatalogApi, 'active' | 'nameOf'>): Tuning {
  const id = PRESENCE_FIELDS[field];
  return {
    key: field,
    icon: ICONS[field],
    label: () => t(`policy.presence.${id}.label`),
    description: t(`policy.presence.${id}.hint`),
    enabled: true,
    value: policy[field],
    options: () => active('signal_modes').map((mode) => ({ value: mode.code, label: mode.name })),
    stricter: 'higher',
    pick: (code) => ({
      changes: { [field]: code },
      title: () => t('policy.presence.saved', { label: t(`policy.presence.${id}.label`), mode: nameOf('signal_modes', code) }),
      detail: () => t(`policy.presence.${id}.hint`),
      warning: code === 'ENFORCE' ? () => t(`policy.presence.${id}.enforceWarning`) : undefined,
    }),
  };
}

interface PresenceSectionProps {
  policy: AdminVerificationPolicy;
  /** Ajuste que se está guardando (su control queda deshabilitado). */
  saving: string | null;
  /** Se eligió otro modo: quien guarda pregunta antes (con su "antes → después" y, si relaja, la regla de dos personas). */
  onSave: (save: TuningSave) => void;
}

/**
 * Prueba de presencia (antifraude 2b, solo el ADMIN): la firma por petición del dispositivo del validador, su ubicación
 * en cada identificación y el código de sitio al checar. Cada uno nace «Solo medir»; bajar de modo relaja la seguridad
 * y queda por aprobar (regla de dos personas) como cualquier otro control. Los niveles predefinidos no los cambian.
 */
export function PresenceSection({ policy, saving, onSave }: PresenceSectionProps) {
  const t = useT();
  const catalogs = useCatalogs();
  return (
    <PanelSection title={t('policy.presence.title')} icon={<MapPinCheck size={20} />}>
      <p className="muted small">{t('policy.presence.hint')}</p>
      <div className="stack">
        {(Object.keys(PRESENCE_FIELDS) as PresenceField[]).map((field) => (
          <TuningRow key={field} tuning={presenceTuning(policy, field, catalogs)} saving={saving} onSave={onSave} />
        ))}
      </div>
    </PanelSection>
  );
}
