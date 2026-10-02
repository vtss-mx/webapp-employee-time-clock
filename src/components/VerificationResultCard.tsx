import { ArrowLeft, RotateCcw, UserRoundCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import type { VerificationResult } from '../types';
import { formatConfidence, formatDateTime } from '../utils/format';
import { haptic } from '../utils/haptics';
import { Button } from './ui/Button';
import { StatusMark } from './ui/StatusMark';

/** Punto de control: un operador identifica a otras personas y la pantalla vuelve sola al inicio. */
export interface KioskOptions {
  autoReturnSeconds: number;
}

interface Props {
  result: VerificationResult | null;
  /** Mensaje de error cuando no hubo resultado (p. ej. error de red). */
  error?: string | null;
  failureTitle: string;
  onRetry: () => void;
  onBack: () => void;
  kiosk?: KioskOptions;
}

function texts(result: VerificationResult | null, kiosk: boolean) {
  const firstName = result?.name?.split(' ')[0];
  return kiosk
    ? { title: 'Empleado identificado', greeting: `Identidad confirmada: ${result?.name ?? ''}.`, done: 'Siguiente persona', back: 'Volver al inicio' }
    : { title: 'Identificación exitosa', greeting: `¡Hola, ${firstName}! Tu identidad fue confirmada.`, done: 'Finalizar', back: 'Cambiar método' };
}

export function VerificationResultCard({ result, error, failureTitle, onRetry, onBack, kiosk }: Props) {
  const success = Boolean(result?.verified);
  const copy = texts(result, Boolean(kiosk));
  const left = useCountdown(kiosk?.autoReturnSeconds, onBack);
  // Confirmación táctil al aparecer el resultado (en teléfonos compatibles).
  useEffect(() => haptic(success ? 'success' : 'error'), [success]);
  const backLabel = success ? copy.done : copy.back;
  return (
    <div className="result-card" role="alert">
      <StatusMark kind={success ? 'success' : 'error'} once />
      <div className="stack" style={{ gap: 6 }}>
        <h1>{success ? copy.title : failureTitle}</h1>
        <p className="muted">{success ? copy.greeting : error ?? result?.message}</p>
      </div>

      {success && result && (
        <dl className="result-card__details stagger">
          <div>
            <dt>Empleado</dt>
            <dd>{result.name}</dd>
          </div>
          <div>
            <dt>Número</dt>
            <dd>{result.employee_number}</dd>
          </div>
          {result.confidence != null && (
            <div>
              <dt>Confianza</dt>
              <dd>{formatConfidence(result.confidence)}</dd>
            </div>
          )}
          <div>
            <dt>Fecha y hora</dt>
            <dd>{formatDateTime(result.verified_at)}</dd>
          </div>
        </dl>
      )}

      <div className="result-card__actions">
        {!success && (
          <Button variant="primary" size="lg" block icon={<RotateCcw size={20} />} onClick={onRetry}>
            Intentar de nuevo
          </Button>
        )}
        <Button
          variant={success ? 'primary' : 'ghost'}
          size="lg"
          block
          icon={success ? kiosk && <UserRoundCheck size={20} /> : <ArrowLeft size={20} />}
          onClick={onBack}
        >
          {left === null ? backLabel : `${backLabel} (${left})`}
        </Button>
        {kiosk && (
          <span className="result-card__timer" style={{ animationDuration: `${kiosk.autoReturnSeconds}s` }} aria-hidden />
        )}
      </div>
    </div>
  );
}
