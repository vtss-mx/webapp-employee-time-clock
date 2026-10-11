import { Check } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import { useT } from '../i18n';
import type { StepperStep } from '../utils/enrollmentStepRules';

/**
 * Indicador de los pasos del registro de identidad, DINÁMICO (decisión del dueño del producto, 2026-10-08: el ADMIN
 * decide, por empresa, cuáles pasos se piden y en qué orden). Recibe los pasos tal como los reporta el servidor y su
 * NOMBRE sale del catálogo `enrollment_steps` (traducido por el backend); al final siempre va «Listo».
 *
 * Estados fijos, sin animaciones: un número en un círculo y su nombre; el actual con el color de la marca, los HECHOS
 * completos en verde con la palomita (adenda del dueño, 2026-10-07: «se debe marcar todo en verde siempre y cuando se
 * haya procesado de manera correcta») y los que faltan atenuados. Lo verde solo sale de `done` del SERVIDOR, nunca de
 * un estado local u optimista. En «En validación» se dibuja con `current = null`: todos hechos y «Listo» en curso.
 */
export function EnrollmentStepper({ steps, current }: { steps: readonly StepperStep[]; current: string | null }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  // «Listo» no es un paso del flujo: es el final (el registro queda con la empresa), así que su nombre sí es de la app.
  const index = current === null ? steps.length : steps.findIndex((step) => step.code === current);
  const total = steps.length + 1;
  return (
    <ol className="enroll-steps" aria-label={t('employee.enrollment.steps.label', { current: index + 1, total })}>
      {steps.map((step, i) => (
        <li key={step.code} className={step.done ? 'is-done' : i === index ? 'is-current' : ''} aria-current={i === index ? 'step' : undefined}>
          <span className="enroll-steps__dot" aria-hidden>
            {step.done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
          </span>
          <span className="enroll-steps__name">{nameOf('enrollment_steps', step.code)}</span>
        </li>
      ))}
      <li className={index === steps.length ? 'is-current' : ''} aria-current={index === steps.length ? 'step' : undefined}>
        <span className="enroll-steps__dot" aria-hidden>
          {total}
        </span>
        <span className="enroll-steps__name">{t('employee.enrollment.steps.done')}</span>
      </li>
    </ol>
  );
}
