import { Camera, Check, Lock, ScanFace, Video, type LucideIcon } from 'lucide-react';
import { useT } from '../../i18n';
import { config } from '../../utils/config';
import type { EnrollmentProgress } from '../../types';
import { Button } from '../ui/Button';
import { enrollmentStepViews, type EnrollmentStepKey, type EnrollmentStepTone } from './enrollmentStepRules';

const ICONS: Record<EnrollmentStepKey, LucideIcon> = { photo: Camera, captures: ScanFace, video: Video };
/** El color de la etiqueta del estado (las del resto de la app, sin animación). */
const BADGES: Record<EnrollmentStepTone, string> = { pending: 'badge--info', done: 'badge--success', locked: 'badge--muted', warn: 'badge--warning' };

/**
 * El índice del registro facial (decisión del dueño del producto, 2026-10-07): las opciones independientes en orden, cada
 * una con su número, su nombre, una descripción corta, su estado desde el servidor y su botón (que abre SU pantalla).
 * Un paso bloqueado dice qué falta; estados fijos, sin animaciones. Un paso HECHO se ve completo en verde (adenda del
 * dueño, 2026-10-07: «se debe marcar todo en verde siempre y cuando se haya procesado de manera correcta»): la palomita
 * en lugar del número, ícono, título, etiqueta, borde y fondo (la clase `--done` lo pinta; su acción secundaria queda
 * neutra). Solo lo que respondió el servidor (`progress`) lo marca: nada se pinta por un estado local u optimista.
 */
export function EnrollmentSteps({ progress, onOpen }: { progress: EnrollmentProgress; onOpen: (step: EnrollmentStepKey) => void }) {
  const t = useT();
  const views = enrollmentStepViews(progress);
  return (
    <ol className="enroll-index" aria-label={t('employee.enrollment.index.label')}>
      {views.map((view, index) => {
        const Icon = ICONS[view.key];
        return (
          <li key={view.key} className={`enroll-index__step enroll-index__step--${view.tone}`}>
            <span className="enroll-index__number" aria-hidden>
              {view.tone === 'done' ? <Check size={18} strokeWidth={2.5} /> : index + 1}
            </span>
            <div className="enroll-index__body">
              <div className="enroll-index__head">
                <Icon size={18} aria-hidden />
                <strong>{t(`employee.enrollment.index.${view.key}.title`)}</strong>
                <span className={`badge badge--plain ${BADGES[view.tone]}`}>
                  {view.tone === 'locked' && <Lock size={12} aria-hidden />}
                  {view.badge}
                </span>
              </div>
              <p className="muted small">{t(`employee.enrollment.index.${view.key}.text`, { count: config.enrollmentValidPhotos })}</p>
              {view.hint && <p className="enroll-index__hint small">{view.hint}</p>}
            </div>
            {view.action && (
              <Button
                className="enroll-index__action"
                variant={view.action.primary ? 'primary' : 'secondary'}
                onClick={() => onOpen(view.key)}
              >
                {t(`employee.enrollment.index.action.${view.action.label}`)}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
