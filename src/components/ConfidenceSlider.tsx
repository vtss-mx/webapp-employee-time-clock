import { Gauge, RotateCcw, Save } from 'lucide-react';
import { useId, useState } from 'react';
import { useCatalogs } from '../hooks/useCatalogs';
import { useConfirm } from '../hooks/useConfirm';
import { useSyncOnChange } from '../hooks/useSyncOnChange';
import type { ConfidenceLevelItem } from '../types';
import type { ConfirmInput } from '../types/confirm';
import { formatConfidence } from '../utils/format';
import { Button } from './ui/Button';

/** Nivel activo más cercano a un valor guardado o a una posición del control (en empate, el primero). */
function nearestLevel([first, ...rest]: ConfidenceLevelItem[], target: number, measure: (level: ConfidenceLevelItem) => number) {
  return rest.reduce((best, level) => (Math.abs(measure(level) - target) < Math.abs(measure(best) - target) ? level : best), first);
}
const byValue = (level: ConfidenceLevelItem) => level.value;
const byPosition = (level: ConfidenceLevelItem) => level.sort_order;

/** Cómo se lee un nivel: "99 % (Estricto)". */
const levelText = (level: ConfidenceLevelItem) => `${formatConfidence(level.value)} (${level.name})`;

/** Cifras medidas del nivel: se muestran bajo el control y en su confirmación. */
const levelStats = (level: ConfidenceLevelItem) => [
  { label: 'Similitud exigida', value: level.similarity.toFixed(3) },
  { label: 'Impostores aceptados', value: level.false_accept_rate === 0 ? '0 de 3 000' : `≈ ${level.false_accept_rate} %` },
  { label: 'Rechazos de una captura legítima', value: `≈ ${level.rejection_rate} %` },
];

/**
 * Confirmación de un nivel nuevo (siempre se pregunta), con el nivel "antes → después". Bajarlo
 * acepta con más facilidad a una persona parecida (se advierte en rojo); un nivel muy estricto
 * (≥ 10 % de rechazos legítimos) avisa de los reintentos y de cómo reducirlos.
 */
function levelConfirm(label: string, saved: ConfidenceLevelItem, next: ConfidenceLevelItem): ConfirmInput {
  const strict = next.rejection_rate >= 10;
  const lower = next.value < saved.value;
  return {
    kind: 'edit',
    tone: lower ? 'danger' : strict ? 'warning' : 'primary',
    icon: <Gauge size={30} />,
    eyebrow: 'Nivel de confianza',
    title: `¿Exigir ${formatConfidence(next.value)} de confianza?`,
    message: lower
      ? 'Un nivel más bajo acepta con más facilidad a una persona parecida: habrá menos reintentos, pero menos seguridad.'
      : strict
        ? 'Es el nivel más estricto: aumenta la seguridad, pero habrá más reintentos.'
        : 'Un nivel más alto protege mejor contra personas parecidas.',
    changes: [{ label, before: levelText(saved), after: levelText(next) }],
    detailsTitle: strict ? 'Antes de exigirlo' : 'Con este nivel',
    details: strict
      ? [
          ...(next.sort_order >= 100 ? [`Ningún sistema biométrico puede garantizar el 100 %: se aplica el máximo calibrado, ${formatConfidence(next.value)}.`] : []),
          `Aproximadamente ${next.rejection_rate} % de las capturas legítimas no alcanzan el nivel y se repiten.`,
          'Pide a los empleados buena iluminación y mirar de frente a la cámara.',
        ]
      : levelStats(next),
    note: 'Aplica en segundos a todas las verificaciones faciales de la empresa.',
    confirmLabel: 'Guardar nivel',
    confirmIcon: <Save size={18} />,
  };
}

interface ConfidenceSliderProps {
  /** Nivel vigente (guardado). */
  value: number;
  /** Nombre accesible del control (hay uno para verificar y otro para identificar entre todos). */
  label?: string;
  busy?: boolean;
  onSave: (value: number) => void;
}

/**
 * Control del nivel de confianza exigido al reconocimiento facial. Los niveles (posición, nombre,
 * valor y cifras medidas en LFW con el modelo de producción) vienen del catálogo confidence_levels:
 * la posición del control es su `sort_order`. El nivel "100" aplica el máximo calibrado (99.999 %):
 * ningún sistema biométrico puede garantizar el 100 %.
 */
export function ConfidenceSlider(props: ConfidenceSliderProps) {
  const levels = useCatalogs().active('confidence_levels');
  // La API solo acepta valores de niveles activos; uno anterior se muestra en el nivel más cercano.
  if (!levels.length) return null;
  return <LevelSlider {...props} levels={levels} saved={nearestLevel(levels, props.value, byValue)} />;
}

interface LevelSliderProps extends ConfidenceSliderProps {
  levels: ConfidenceLevelItem[];
  saved: ConfidenceLevelItem;
}

function LevelSlider({ levels, saved, busy = false, onSave, label = 'Nivel de confianza requerido' }: LevelSliderProps) {
  const [position, setPosition] = useState<number>(saved.sort_order);
  useSyncOnChange(saved.sort_order, setPosition); // al guardarse o cargarse otro nivel
  const id = useId();
  const confirm = useConfirm();

  // Posiciones sin nivel activo se ajustan al más cercano.
  const step = nearestLevel(levels, position, byPosition);
  const current = step.sort_order;
  const min = levels[0].sort_order;
  const max = levels[levels.length - 1].sort_order;

  /** Cada nivel nuevo se confirma antes de guardarse; cancelar deja el control donde está, sin guardar. */
  const save = async () => {
    if (await confirm(levelConfirm(label, saved, step))) onSave(step.value);
  };
  const changed = current !== saved.sort_order;
  const fill = ((current - min) / Math.max(1, max - min)) * 100;

  return (
    <div className="confidence">
      <div className="confidence__readout" aria-live="polite">
        <span className="confidence__icon">
          <Gauge size={22} />
        </span>
        <div>
          <strong className="confidence__value">{formatConfidence(step.value)}</strong>
          <span className="confidence__level">
            {step.name}
            {!changed && <span className="badge badge--info">Vigente</span>}
          </span>
        </div>
      </div>

      <div className="confidence__slider" style={{ ['--fill' as string]: `${fill}%` }}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={current}
          disabled={busy}
          aria-label={label}
          aria-valuetext={`${formatConfidence(step.value)} (${step.name})`}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
        <div className="confidence__ticks" aria-hidden>
          {levels.map(({ code, sort_order: at }) => (
            <button
              key={code}
              type="button"
              tabIndex={-1}
              className={`confidence__tick ${at <= current ? 'is-on' : ''} ${at === current ? 'is-current' : ''}`}
              disabled={busy}
              onClick={() => setPosition(at)}
            >
              {/* Número cada 5 puntos (y en la posición elegida); marca en los demás */}
              {at % 5 === 0 || at === current ? at : <span className="confidence__dot" />}
            </button>
          ))}
        </div>
      </div>

      <dl className="confidence__stats">
        {levelStats(step).map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="confidence__actions">
        <Button variant="ghost" icon={<RotateCcw size={18} />} disabled={!changed || busy} onClick={() => setPosition(saved.sort_order)}>
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
