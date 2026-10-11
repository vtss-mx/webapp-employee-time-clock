import { Camera, Check, CircleHelp, FileText, IdCard, Lock, ScanFace, Video, type LucideIcon } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { EnrollmentProgress } from '../../types';
import { enrollmentStepViews, type EnrollmentStepTone } from '../../utils/enrollmentStepRules';
import { Button } from '../ui/Button';

/** El ícono de cada paso conocido; uno nuevo del backend se dibuja con el genérico. */
const ICONS: Record<string, LucideIcon> = {
  OFFICIAL_ID: IdCard,
  PROOF_OF_ADDRESS: FileText,
  INITIAL_PHOTO: Camera,
  FACE_CAPTURES: ScanFace,
  VOICE_VIDEO: Video,
};

/** El color de la etiqueta del estado (las del resto de la app, sin animación). */
const BADGES: Record<EnrollmentStepTone, string> = { pending: 'badge--info', done: 'badge--success', locked: 'badge--muted', warn: 'badge--warning' };

/**
 * El índice del registro de identidad: los pasos que pide SU empresa, EN SU ORDEN (decisión del dueño del producto,
 * 2026-10-08: el flujo es dinámico y vive en un solo módulo). Cada uno con su número, su NOMBRE y su descripción del
 * catálogo `enrollment_steps` (el backend los envía traducidos; la app nunca los escribe), su estado desde el servidor
 * y su botón, que abre SU pantalla.
 *
 * Un paso HECHO se ve completo en verde (adenda del dueño, 2026-10-07): la palomita en lugar del número, ícono,
 * título, etiqueta, borde y fondo; su acción secundaria («Repetir foto», «Reemplazar documento») queda neutra. Solo lo
 * que respondió el servidor (`progress`) lo marca. Un paso que esta versión no conoce se dibuja atenuado, con su
 * nombre del catálogo y sin botón: la pantalla nunca se rompe por un backend más nuevo.
 */
export function EnrollmentSteps({ progress, onOpen }: { progress: EnrollmentProgress; onOpen: (code: string) => void }) {
  const t = useT();
  const { nameOf, byCode } = useCatalogs();
  const views = enrollmentStepViews(progress, (code) => nameOf('enrollment_steps', code));
  return (
    <ol className="enroll-index" aria-label={t('employee.enrollment.index.label')}>
      {views.map((view) => {
        const Icon = ICONS[view.code] ?? CircleHelp;
        const description = byCode('enrollment_steps', view.code)?.description;
        return (
          <li key={view.code} className={`enroll-index__step enroll-index__step--${view.tone}`}>
            <span className="enroll-index__number" aria-hidden>
              {view.tone === 'done' ? <Check size={18} strokeWidth={2.5} /> : view.position}
            </span>
            <div className="enroll-index__body">
              <div className="enroll-index__head">
                <Icon size={18} aria-hidden />
                <strong>{nameOf('enrollment_steps', view.code)}</strong>
                <span className={`badge badge--plain ${BADGES[view.tone]}`}>
                  {view.tone === 'locked' && <Lock size={12} aria-hidden />}
                  {view.badge}
                </span>
              </div>
              {description && <p className="muted small">{description}</p>}
              {view.hint && <p className="enroll-index__hint small">{view.hint}</p>}
            </div>
            {view.action && (
              <Button className="enroll-index__action" variant={view.action.primary ? 'primary' : 'secondary'} onClick={() => onOpen(view.code)}>
                {t(`employee.enrollment.index.action.${view.action.label}`)}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
