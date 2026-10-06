import { Gauge, RotateCcw, Save } from 'lucide-react';
import { useId, useState } from 'react';
import { useCatalogs } from '../hooks/useCatalogs';
import { useConfirm } from '../hooks/useConfirm';
import { useSyncOnChange } from '../hooks/useSyncOnChange';
import { t, useT } from '../i18n';
import { resolveLazy, type LazyText } from '../i18n/lazy';
import type { ConfidenceLevelItem } from '../types';
import type { ConfirmInput } from '../types/confirm';
import { formatConfidence } from '../utils/format';
import { formatRate, localeNumberFormat } from '../utils/numbers';
import { Button } from './ui/Button';

/** Nivel activo más cercano a un valor guardado o a una posición del control (en empate, el primero). */
function nearestLevel([first, ...rest]: ConfidenceLevelItem[], target: number, measure: (level: ConfidenceLevelItem) => number) {
  return rest.reduce((best, level) => (Math.abs(measure(level) - target) < Math.abs(measure(best) - target) ? level : best), first);
}
const byValue = (level: ConfidenceLevelItem) => level.value;
const byPosition = (level: ConfidenceLevelItem) => level.sort_order;

/** Cómo se lee un nivel: "99 % (Estricto)" (el nombre viene del catálogo). */
const levelText = (level: ConfidenceLevelItem) => t('face.confidence.level', { value: formatConfidence(level.value), name: level.name });

/** Porcentaje medido (0 a 100) con hasta tres decimales, en el formato del idioma activo. */
const rate = (value: number) => formatRate(value, 3);

/** Cifras medidas del nivel: se muestran bajo el control y en su confirmación (en el idioma activo). */
const levelStats = (level: ConfidenceLevelItem) => [
  { label: t('face.confidence.similarity'), value: localeNumberFormat({ minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(level.similarity) },
  { label: t('face.confidence.impostors'), value: level.false_accept_rate === 0 ? t('face.confidence.noImpostors') : `≈ ${rate(level.false_accept_rate)}` },
  { label: t('face.confidence.rejections'), value: `≈ ${rate(level.rejection_rate)}` },
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
    eyebrow: t('face.confidence.eyebrow'),
    title: t('face.confidence.confirmTitle', { value: formatConfidence(next.value) }),
    message: lower ? t('face.confidence.lower') : strict ? t('face.confidence.strict') : t('face.confidence.higher'),
    changes: [{ label, before: levelText(saved), after: levelText(next) }],
    detailsTitle: strict ? t('face.confidence.beforeRequiring') : t('face.confidence.withLevel'),
    details: strict
      ? [
          ...(next.sort_order >= 100 ? [t('face.confidence.maxCalibrated', { value: formatConfidence(next.value) })] : []),
          t('face.confidence.retries', { rate: rate(next.rejection_rate) }),
          t('face.confidence.tips'),
        ]
      : levelStats(next),
    note: t('face.confidence.note'),
    confirmLabel: t('face.confidence.save'),
    confirmIcon: <Save size={18} />,
  };
}

interface ConfidenceSliderProps {
  /** Nivel vigente (guardado). */
  value: number;
  /**
   * Nombre accesible del control (hay uno para verificar y otro para identificar entre todos). Con una
   * función (`() => t('…')`) también la confirmación abierta sigue al idioma activo.
   */
  label?: LazyText;
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

/** Nombre del control en el idioma activo (el propio o, por omisión, "Nivel de confianza requerido"). */
const sliderLabel = (label: LazyText | undefined) => (label === undefined ? t('face.confidence.label') : resolveLazy(label));

function LevelSlider({ levels, saved, busy = false, onSave, label: labelSource }: LevelSliderProps) {
  const t = useT();
  const label = sliderLabel(labelSource);
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
    if (await confirm(() => levelConfirm(sliderLabel(labelSource), saved, step))) onSave(step.value);
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
            {!changed && <span className="badge badge--info">{t('face.confidence.current')}</span>}
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
          aria-valuetext={levelText(step)}
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
          {t('face.confidence.reset')}
        </Button>
        <Button
          variant="primary"
          icon={<Save size={18} />}
          loading={busy}
          disabled={!changed}
          title={changed ? undefined : t('face.confidence.moveHint')}
          onClick={() => void save()}
        >
          {t('face.confidence.save')}
        </Button>
      </div>
    </div>
  );
}
