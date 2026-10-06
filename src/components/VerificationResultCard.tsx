import { ArrowLeft, Clock, RotateCcw, UserRoundCheck } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { t, useLocale, useT } from '../i18n';
import { resolveLazy, type LazyText } from '../i18n/lazy';
import type { ValidatorAttendance, VerificationResult } from '../types';
import { formatConfidence, formatDateTime } from '../utils/format';
import { haptic } from '../utils/haptics';
import { ACTION_ICONS } from './attendance/sessionFacts';
import { Button } from './ui/Button';
import { ResultPopup } from './ui/ResultPopup';
import { StatusMark } from './ui/StatusMark';

/** Punto de control: un operador identifica a otras personas y la pantalla vuelve sola al inicio. */
export interface KioskOptions {
  autoReturnSeconds: number;
}

interface Props {
  result: VerificationResult | null;
  /** Mensaje de error cuando no hubo resultado (p. ej. error de red); con una función, se escribe al dibujarse. */
  error?: LazyText | null;
  failureTitle: string;
  onRetry: () => void;
  onBack: () => void;
  kiosk?: KioskOptions;
  /** Texto del botón para salir cuando no hubo éxito (por omisión, el del modo: "Cambiar método" o "Volver al inicio"). */
  backLabel?: string;
}

/** Textos del resultado según el modo (punto de control o el propio empleado), en el idioma activo. */
function texts(result: VerificationResult | null, kiosk: boolean) {
  const name = result?.name ?? '';
  return kiosk
    ? {
        title: t('verification.result.kiosk.title'),
        greeting: t('verification.result.kiosk.greeting', { name }),
        done: t('verification.result.kiosk.next'),
        back: t('verification.result.kiosk.home'),
      }
    : {
        title: t('verification.result.self.title'),
        greeting: t('verification.result.self.greeting', { name: name.split(' ')[0] }),
        done: t('verification.result.self.finish'),
        back: t('verification.result.self.changeMethod'),
      };
}

/**
 * Validador: lo que la identificación registró en la asistencia ("Entrada registrada a las 07:55.") o
 * por qué no registró nada ("Sin turno para registrar en este momento."). Lo decide el servidor.
 */
function AttendanceNote({ attendance }: { attendance: ValidatorAttendance }) {
  const Icon = attendance.action ? ACTION_ICONS[attendance.action] : Clock;
  return (
    <p className={`result-card__attendance ${attendance.action ? 'is-recorded' : ''}`}>
      <Icon size={20} aria-hidden />
      {attendance.message}
    </p>
  );
}

/** Quién se identificó, con qué confianza y cuándo (y, en un validador, lo registrado en su asistencia). */
function IdentifiedDetails({ result }: { result: VerificationResult }) {
  const t = useT();
  return (
    <>
      {result.attendance && <AttendanceNote attendance={result.attendance} />}
      <dl className="result-card__details stagger">
        <div>
          <dt>{t('common.fields.employee')}</dt>
          <dd>{result.name}</dd>
        </div>
        <div>
          <dt>{t('verification.result.number')}</dt>
          <dd>{result.employee_number}</dd>
        </div>
        {result.confidence != null && (
          <div>
            <dt>{t('verification.result.confidence')}</dt>
            <dd>{formatConfidence(result.confidence)}</dd>
          </div>
        )}
        <div>
          <dt>{t('verification.result.dateTime')}</dt>
          <dd>{formatDateTime(result.verified_at)}</dd>
        </div>
      </dl>
    </>
  );
}

/**
 * Resultado de una identificación (rostro o QR) en un popup sobre la pantalla: quién es, con qué
 * confianza y cuándo; si falló, el motivo y "Intentar de nuevo". Cerrarlo es lo mismo que su botón
 * para salir.
 */
export function VerificationResultCard({ result, error, failureTitle, onRetry, onBack, kiosk, backLabel: failureBack }: Props) {
  useLocale(); // los textos se escriben al dibujarse: un cambio de idioma los traduce
  const success = Boolean(result?.verified);
  const copy = texts(result, Boolean(kiosk));
  const left = useCountdown(kiosk?.autoReturnSeconds, onBack);
  // Confirmación táctil al aparecer el resultado (en teléfonos compatibles).
  useEffect(() => haptic(success ? 'success' : 'error'), [success]);
  const backLabel = success ? copy.done : (failureBack ?? copy.back);
  const titleId = useId();
  return (
    <ResultPopup kind={success ? 'success' : 'error'} labelledBy={titleId} onDismiss={onBack}>
      <div className="result-card result-card--popup">
      <StatusMark kind={success ? 'success' : 'error'} once />
      <div className="stack" style={{ gap: 6 }}>
        <h1 id={titleId}>{success ? copy.title : failureTitle}</h1>
        <p className="muted">{success ? copy.greeting : error ? resolveLazy(error) : result?.message}</p>
      </div>
      {success && result && <IdentifiedDetails result={result} />}

      <div className="result-card__actions">
        {!success && (
          <Button variant="primary" size="lg" block icon={<RotateCcw size={20} />} onClick={onRetry}>
            {t('verification.result.retry')}
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
    </ResultPopup>
  );
}
