import { Eye, ImageOff, Images } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { t, useT } from '../../i18n';
import { fraudCaseService } from '../../services/fraudCaseService';
import type { FraudEvidenceImage, FraudEvidenceItem } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

/** Qué muestra cada fotograma (el backend manda el código: frontal, movimiento del reto o color del destello). */
const KINDS: Partial<Record<string, 'frontal' | 'step' | 'flash' | 'burst'>> = { FRONTAL: 'frontal', STEP: 'step', FLASH: 'flash', BURST: 'burst' };
const kindText = (kind: string) => {
  const key = KINDS[kind];
  return key ? t(`fraud.evidence.kinds.${key}`) : kind;
};

const viewError = () => t('fraud.evidence.error');

/**
 * Ver la evidencia es la excepción documentada a "el ADMIN no ve biometría" (decisión D1): se confirma diciendo que
 * cada fotograma consultado queda en el historial del caso y que se borra solo al vencer.
 */
function viewConfirm(count: number): ConfirmInput {
  return {
    kind: 'action',
    tone: 'warning',
    icon: <Eye size={30} />,
    eyebrow: t('fraud.evidence.eyebrow'),
    title: t('fraud.evidence.confirmTitle', { count }),
    message: t('fraud.evidence.confirmMessage'),
    note: t('fraud.evidence.confirmNote'),
    confirmLabel: t('fraud.evidence.show'),
    confirmIcon: <Eye size={18} />,
  };
}

/**
 * Los fotogramas de un intento sospechoso, cifrados en el bucket: se piden por la API (nunca una URL del bucket) solo
 * cuando el ADMIN lo confirma, y cada uno queda en el historial. Viven en memoria mientras la pantalla está abierta.
 * Si alguno ya venció o el bucket no responde, se avisa en un popup y se muestran los demás.
 */
export function FraudEvidence({ caseId, items, onViewed }: { caseId: number; items: FraudEvidenceItem[]; onViewed: () => void }) {
  const t = useT();
  const [images, setImages] = useState<FraudEvidenceImage[] | null>(null);
  const { busy, run } = useAction();

  if (!items.length) return <EmptyState compact icon={<ImageOff />} title={t('fraud.evidence.emptyTitle')} description={t('fraud.evidence.emptyDescription')} />;

  const show = () =>
    void run(
      async () => {
        const settled = await Promise.allSettled(items.map((item) => fraudCaseService.evidence(caseId, item.id)));
        setImages(settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])));
        onViewed(); // cada consulta quedó en el historial del caso
        const failed = settled.find((result) => result.status === 'rejected');
        if (failed) throw failed.reason;
      },
      { confirm: () => viewConfirm(items.length), errorTitle: viewError },
    );

  return (
    <div className="stack">
      <p className="muted small">{t('fraud.evidence.hint', { count: items.length, date: formatDateTime(items[0].created_at) })}</p>
      {images ? (
        <ul className="evidence-grid">
          {images.map((image) => (
            <li key={image.id} className="evidence-grid__item">
              <img src={`data:${image.content_type};base64,${image.data}`} alt={t('fraud.evidence.alt', { kind: kindText(image.kind), position: image.position + 1 })} />
              <span className="small muted">{t('fraud.evidence.caption', { kind: kindText(image.kind), position: image.position + 1 })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Button variant="secondary" icon={<Images size={18} />} loading={busy !== null} onClick={show}>
          {t('fraud.evidence.show')}
        </Button>
      )}
    </div>
  );
}
