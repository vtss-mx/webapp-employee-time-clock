import { Check } from 'lucide-react';
import { useT } from '../i18n';

/**
 * Los pasos del registro facial (decisión del dueño del producto, 2026-10-06; el orden no se altera): foto inicial
 * válida → 32 capturas válidas con los movimientos → video con tres preguntas → listo. Desde el 2026-10-07 cada uno es
 * una pantalla aparte (índice en `EnrollmentPage`, pantallas en `EnrollmentStepPages`): el indicador dice cuál es.
 */
export type EnrollmentStep = 'photo' | 'captures' | 'video' | 'done';

export const ENROLLMENT_STEPS: readonly EnrollmentStep[] = ['photo', 'captures', 'video', 'done'];

/**
 * Indicador sobrio de los pasos (estados fijos, sin animaciones): un número en un círculo y su nombre; el actual con el
 * color de la marca, los hechos COMPLETOS en verde con la palomita (adenda del dueño, 2026-10-07: «se debe marcar todo en
 * verde siempre y cuando se haya procesado de manera correcta»), los que faltan atenuados. En «En validación» se dibuja
 * con `current="done"`: los tres pasos hechos. Sin la verificación por voz de la política, el paso del video no se
 * muestra.
 */
export function EnrollmentStepper({ current, withVideo }: { current: EnrollmentStep; withVideo: boolean }) {
  const t = useT();
  const steps = ENROLLMENT_STEPS.filter((step) => withVideo || step !== 'video');
  const index = steps.indexOf(current);
  return (
    <ol className="enroll-steps" aria-label={t('employee.enrollment.steps.label', { current: index + 1, total: steps.length })}>
      {steps.map((step, i) => (
        <li key={step} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} aria-current={i === index ? 'step' : undefined}>
          <span className="enroll-steps__dot" aria-hidden>
            {i < index ? <Check size={14} strokeWidth={2.5} /> : i + 1}
          </span>
          <span className="enroll-steps__name">{t(`employee.enrollment.steps.${step}`)}</span>
        </li>
      ))}
    </ol>
  );
}
