import { Gauge, RotateCcw, Save } from 'lucide-react';
import { useId, useState } from 'react';
import { useSyncOnChange } from '../hooks/useSyncOnChange';
import { useFeedback } from '../hooks/useFeedback';
import { formatConfidence } from '../utils/format';
import { Button } from './ui/Button';

/**
 * Posiciones del control: 80 % a 100 % en pasos de 1 %. "100" aplica el máximo calibrado
 * (99.999 %): ningún sistema biométrico puede garantizar el 100 % (exigiría una coincidencia
 * perfecta y nadie la alcanzaría).
 *
 * Cifras medidas en LFW (6 000 pares) con el modelo de producción: similitud exigida, falsos
 * aceptados y rechazos de UNA captura legítima (la verificación usa 3 capturas).
 */
export const CONFIDENCE_STEPS = [
  { position: 80, value: 0.8, similarity: 0.386, falseAccept: 0.033, rejection: 0.9 },
  { position: 81, value: 0.81, similarity: 0.388, falseAccept: 0.033, rejection: 0.9 },
  { position: 82, value: 0.82, similarity: 0.39, falseAccept: 0.033, rejection: 0.9 },
  { position: 83, value: 0.83, similarity: 0.392, falseAccept: 0.033, rejection: 0.9 },
  { position: 84, value: 0.84, similarity: 0.394, falseAccept: 0.033, rejection: 0.9 },
  { position: 85, value: 0.85, similarity: 0.396, falseAccept: 0.033, rejection: 0.9 },
  { position: 86, value: 0.86, similarity: 0.398, falseAccept: 0.033, rejection: 1.0 },
  { position: 87, value: 0.87, similarity: 0.4, falseAccept: 0.033, rejection: 1.0 },
  { position: 88, value: 0.88, similarity: 0.402, falseAccept: 0.033, rejection: 1.0 },
  { position: 89, value: 0.89, similarity: 0.405, falseAccept: 0.033, rejection: 1.0 },
  { position: 90, value: 0.9, similarity: 0.408, falseAccept: 0.033, rejection: 1.1 },
  { position: 91, value: 0.91, similarity: 0.411, falseAccept: 0.033, rejection: 1.1 },
  { position: 92, value: 0.92, similarity: 0.414, falseAccept: 0.033, rejection: 1.2 },
  { position: 93, value: 0.93, similarity: 0.418, falseAccept: 0.033, rejection: 1.2 },
  { position: 94, value: 0.94, similarity: 0.422, falseAccept: 0.033, rejection: 1.3 },
  { position: 95, value: 0.95, similarity: 0.427, falseAccept: 0.033, rejection: 1.3 },
  { position: 96, value: 0.96, similarity: 0.434, falseAccept: 0.033, rejection: 1.4 },
  { position: 97, value: 0.97, similarity: 0.441, falseAccept: 0.033, rejection: 1.5 },
  { position: 98, value: 0.98, similarity: 0.452, falseAccept: 0.033, rejection: 1.7 },
  { position: 99, value: 0.99, similarity: 0.471, falseAccept: 0, rejection: 2.4 },
  { position: 100, value: 0.99999, similarity: 0.653, falseAccept: 0, rejection: 24.3 },
] as const;

type Step = (typeof CONFIDENCE_STEPS)[number];
const MIN_POSITION = CONFIDENCE_STEPS[0].position;

/** Posición más cercana a un valor guardado (p. ej. 0.99999 → 100). */
export function stepFor(value: number): Step {
  return CONFIDENCE_STEPS.reduce((best, step) => (Math.abs(step.value - value) < Math.abs(best.value - value) ? step : best));
}

function levelName(position: number): string {
  if (position === 100) return 'Máximo';
  if (position === 99) return 'Estricto';
  if (position >= 95) return 'Alto';
  return position >= 90 ? 'Equilibrado' : 'Flexible';
}

interface ConfidenceSliderProps {
  /** Nivel vigente (guardado). */
  value: number;
  busy?: boolean;
  onSave: (value: number) => void;
}

/** Control del nivel de confianza exigido al reconocimiento facial (80 % – 100 %). */
export function ConfidenceSlider({ value, busy = false, onSave }: ConfidenceSliderProps) {
  const saved = stepFor(value);
  const [position, setPosition] = useState<number>(saved.position);
  useSyncOnChange(saved.position, setPosition); // al guardarse o cargarse otro nivel
  const id = useId();
  const feedback = useFeedback();

  const step = CONFIDENCE_STEPS.find((s) => s.position === position) ?? saved;

  /** Niveles muy estrictos se confirman en un popup (más reintentos para los empleados). */
  const save = async () => {
    if (step.rejection >= 10) {
      const choice = await feedback.show({
        variant: 'warning',
        title: `¿Exigir ${formatConfidence(step.value)} de confianza?`,
        text: 'Es el nivel más estricto: aumenta la seguridad, pero habrá más reintentos.',
        details: [
          ...(step.position === 100
            ? ['Ningún sistema biométrico puede garantizar el 100 %: se aplica el máximo calibrado, 99.999 %.']
            : []),
          `Aproximadamente ${step.rejection} % de las capturas legítimas no alcanzan el nivel y se repiten.`,
          'Pide a los empleados buena iluminación y mirar de frente a la cámara.',
        ],
        actions: [
          { id: 'cancel', label: 'Cancelar', variant: 'ghost' },
          { id: 'save', label: 'Guardar nivel', icon: <Save size={18} /> },
        ],
      });
      if (choice !== 'save') return;
    }
    onSave(step.value);
  };
  const changed = step.position !== saved.position;
  const fill = ((position - MIN_POSITION) / (100 - MIN_POSITION)) * 100;

  return (
    <div className="confidence">
      <div className="confidence__readout" aria-live="polite">
        <span className="confidence__icon">
          <Gauge size={22} />
        </span>
        <div>
          <strong className="confidence__value">{formatConfidence(step.value)}</strong>
          <span className="confidence__level">
            {levelName(step.position)}
            {!changed && <span className="badge badge--info">Vigente</span>}
          </span>
        </div>
      </div>

      <div className="confidence__slider" style={{ ['--fill' as string]: `${fill}%` }}>
        <input
          id={id}
          type="range"
          min={MIN_POSITION}
          max={100}
          step={1}
          value={position}
          disabled={busy}
          aria-label="Nivel de confianza requerido"
          aria-valuetext={`${formatConfidence(step.value)} (${levelName(step.position)})`}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
        <div className="confidence__ticks" aria-hidden>
          {CONFIDENCE_STEPS.map((s) => (
            <button
              key={s.position}
              type="button"
              tabIndex={-1}
              className={`confidence__tick ${s.position <= position ? 'is-on' : ''} ${s.position === position ? 'is-current' : ''}`}
              disabled={busy}
              onClick={() => setPosition(s.position)}
            >
              {/* Número cada 5 puntos (y en la posición elegida); marca en los demás */}
              {s.position % 5 === 0 || s.position === position ? s.position : <span className="confidence__dot" />}
            </button>
          ))}
        </div>
      </div>

      <dl className="confidence__stats">
        <div>
          <dt>Similitud exigida</dt>
          <dd>{step.similarity.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Impostores aceptados</dt>
          <dd>{step.falseAccept === 0 ? '0 de 3 000' : `≈ ${step.falseAccept} %`}</dd>
        </div>
        <div>
          <dt>Rechazos de una captura legítima</dt>
          <dd>≈ {step.rejection} %</dd>
        </div>
      </dl>

      <div className="confidence__actions">
        <Button variant="ghost" icon={<RotateCcw size={18} />} disabled={!changed || busy} onClick={() => setPosition(saved.position)}>
          Restablecer
        </Button>
        <Button
          variant="primary"
          icon={<Save size={18} />}
          loading={busy}
          disabled={!changed}
          title={changed ? undefined : 'Mueve el control para elegir otro nivel'}
          onClick={() => void save()}
        >
          Guardar nivel
        </Button>
      </div>
    </div>
  );
}
