import { Fragment, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LazyText } from '../i18n/lazy';
import { paths } from '../routes/paths';
import type { VerificationResult } from '../types';
import { VerificationResultCard, type KioskOptions } from './VerificationResultCard';

export interface VerificationOutcome {
  result: VerificationResult | null;
  /**
   * Por qué no hubo resultado (p. ej. error de red). Con una función (`() => errorMessage(error)`) se
   * escribe al dibujarse: el resultado en pantalla sigue al idioma activo.
   */
  error: LazyText | null;
}

interface VerificationAttemptProps {
  /** Título cuando no se identificó: se pide en cada dibujo (en el idioma activo). */
  failureTitle: (outcome: VerificationOutcome) => string;
  /** Al terminar ("Finalizar" / "Cambiar método"); por omisión, al inicio del empleado. */
  onBack?: () => void;
  /** Cada resultado obtenido (p. ej. para refrescar la lista de identificaciones recientes). */
  onOutcome?: (outcome: VerificationOutcome) => void;
  kiosk?: KioskOptions;
  /** Sesión de captura; se vuelve a montar (key) en cada reintento y libera la cámara al terminar. */
  children: (finish: (outcome: VerificationOutcome) => void) => ReactNode;
}

/** Ciclo común de verificación (rostro o QR): captura → resultado → reintentar / volver. */
export function VerificationAttempt({ failureTitle, onBack, onOutcome, kiosk, children }: VerificationAttemptProps) {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const finish = (next: VerificationOutcome) => {
    setOutcome(next);
    onOutcome?.(next);
  };

  if (outcome) {
    return (
      <div className="page page--narrow">
        <VerificationResultCard
          result={outcome.result}
          error={outcome.error}
          failureTitle={failureTitle(outcome)}
          kiosk={kiosk}
          onRetry={() => {
            setOutcome(null);
            setAttempt((n) => n + 1);
          }}
          onBack={onBack ?? (() => void navigate(paths.employee.dashboard))}
        />
      </div>
    );
  }
  return <Fragment key={attempt}>{children(finish)}</Fragment>;
}
