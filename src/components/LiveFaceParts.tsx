import { Camera, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCatalogs } from '../hooks/useCatalogs';
import { useT } from '../i18n';
import { Button } from './ui/Button';

/*
 * Piezas bajo el visor del flujo facial (`LiveFaceFlow`): solo aparecen cuando hacen falta (enviar el registro a revisión
 * por un accesorio, la captura manual y otra forma de identificarse).
 */

export interface FlowAlternative {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

/** Propuesta de revisión humana cuando el detector insiste en un accesorio que el empleado no usa. */
export function AccessoryReviewPrompt({ accessories, onConfirm }: { accessories: string[]; onConfirm: () => void }) {
  const t = useT();
  const { byCode } = useCatalogs();
  // La frase de cada accesorio ("los lentes") viene del catálogo, ya en el idioma activo.
  const names = accessories.map((code) => byCode('accessories', code)?.phrase ?? code).join(` ${t('face.review.nor')} `);
  return (
    <div className="review-prompt" role="note">
      <strong>{t('face.review.question', { names })}</strong>
      <span className="muted small">{t('face.review.explanation')}</span>
      <Button variant="secondary" block icon={<UserCheck size={18} />} onClick={onConfirm}>
        {t('face.review.confirm', { names })}
      </Button>
    </div>
  );
}

interface FlowExtrasProps {
  /** Accesorios a proponer para revisión humana (null = no se ofrece). */
  reviewAccessories: string[] | null;
  reviewRequested: boolean;
  onReview: () => void;
}

/** Bajo el visor, solo cuando aplica: enviar el registro a revisión si el sistema insiste en un accesorio. */
export function FlowExtras({ reviewAccessories, reviewRequested, onReview }: FlowExtrasProps) {
  const t = useT();
  if (!reviewAccessories && !reviewRequested) return null;
  return (
    <>
      {reviewAccessories && <AccessoryReviewPrompt accessories={reviewAccessories} onConfirm={onReview} />}
      {reviewRequested && (
        <p className="review-prompt review-prompt--sent small" role="status">
          <UserCheck size={16} /> {t('face.review.sent')}
        </p>
      )}
    </>
  );
}

/** Captura manual (si la detección automática no está disponible) y otra forma de identificarse. */
export function FlowActions({ manualCapture, alternative }: { manualCapture: { disabled: boolean; onCapture: () => void } | null; alternative?: FlowAlternative }) {
  const t = useT();
  if (!manualCapture && !alternative) return null;
  return (
    <>
      {manualCapture && (
        <Button variant="primary" size="lg" icon={<Camera size={20} />} disabled={manualCapture.disabled} onClick={manualCapture.onCapture}>
          {t('face.flow.capture')}
        </Button>
      )}
      {alternative && (
        <Button variant="secondary" size="lg" icon={alternative.icon} onClick={alternative.onSelect}>
          {alternative.label}
        </Button>
      )}
    </>
  );
}
