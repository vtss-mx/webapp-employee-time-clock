import { Clock } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { clampToRange, clockText, minuteOptions, overlapsRange, pad2, parseClock, type ClockRange } from './clock';
import { listKeyAction, type SelectOption } from './Select';

/** Hora sugerida del selector ("HH:MM") con un texto propio opcional (p. ej. "Mediodía"). */
export interface TimePreset {
  value: string;
  label?: string;
}

/** Textos del selector de hora (todos personalizables desde `TimeField`). */
export interface TimePanelLabels {
  /** Nombre del selector (ventana). */
  title: string;
  /** Encabezado de la columna de horas. */
  hours: string;
  /** Encabezado de la columna de minutos. */
  minutes: string;
  /** Nombre del grupo de horas sugeridas. */
  presets: string;
}

interface TimePanelProps {
  /** Hora elegida (minutos desde la medianoche) o null. */
  value: number | null;
  /** Dónde abre si aún no hay hora. */
  openTo: number;
  minuteStep: number;
  range: ClockRange;
  presets: ReadonlyArray<string | TimePreset>;
  labels: TimePanelLabels;
  /** Hora elegida; `done` = ya se eligió completa (cierra el selector). */
  onPick: (minutes: number, done: boolean) => void;
  /** Escape o salir con Tab: cierra y regresa el foco al botón del campo. */
  onClose: () => void;
}

type Side = 'hours' | 'minutes';

const option = (value: number, disabled: boolean): SelectOption => ({ value: pad2(value), label: pad2(value), disabled });

/** Sugerencias válidas (las que no son una hora "HH:MM" se ignoran) con su texto. */
function presetItems(presets: ReadonlyArray<string | TimePreset>) {
  return presets.flatMap((preset) => {
    const { value, label = value } = typeof preset === 'string' ? { value: preset } : preset;
    const minutes = parseClock(value);
    return minutes === null ? [] : [{ minutes, label }];
  });
}

/**
 * Selector propio de la hora (nada de la rueda o la lista del sistema): horas sugeridas y dos
 * columnas desplazables, horas (00–23) y minutos (cada `minuteStep`), con lo elegido resaltado y
 * centrado. Elegir la hora pasa a los minutos; elegir los minutos termina.
 *
 * Teclado: flechas arriba/abajo, Inicio/Fin y dígitos dentro de una columna; izquierda/derecha
 * cambian de columna; Enter o Espacio eligen; Escape cierra y Tab sale del selector.
 */
export function TimePanel({ value, openTo, minuteStep, range, presets, labels, onPick, onClose }: TimePanelProps) {
  const id = useId();
  const start = value ?? openTo;
  const [hour, setHour] = useState(Math.floor(start / 60));
  const [minute, setMinute] = useState(start % 60);
  const hoursRef = useRef<HTMLUListElement>(null);
  const minutesRef = useRef<HTMLUListElement>(null);

  // Lo escrito en el campo o elegido aquí mueve las columnas a esa hora.
  useSyncOnChange(value, (next) => {
    if (next === null) return;
    setHour(Math.floor(next / 60));
    setMinute(next % 60);
  });

  // Foco en las horas en el siguiente cuadro: antes de colocarse, la capa flotante es invisible y no recibe foco.
  useEffect(() => {
    const frame = requestAnimationFrame(() => hoursRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const selectedMinute = value === null ? null : value % 60;
  const baseHour = value === null ? hour : Math.floor(value / 60);
  const hours = Array.from({ length: 24 }, (_, h) => option(h, !overlapsRange(h * 60, h * 60 + 59, range)));
  const minuteValues = minuteOptions(minuteStep, [selectedMinute, minute]);
  const minutes = minuteValues.map((m) => option(m, !overlapsRange(baseHour * 60 + m, baseHour * 60 + m, range)));
  const focusSide = (side: Side) => (side === 'hours' ? hoursRef : minutesRef).current?.focus();

  const chooseHour = (index: number) => {
    if (hours[index].disabled) return;
    // Conserva los minutos elegidos; si con esa hora quedan fuera de los límites, se ajustan al más cercano.
    onPick(clampToRange(index * 60 + (selectedMinute ?? minute), range), false);
    setHour(index);
    focusSide('minutes');
  };
  const chooseMinute = (index: number) => {
    if (!minutes[index].disabled) onPick(baseHour * 60 + minuteValues[index], true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // no cierra la ventana emergente que contiene el campo
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    // Salir con Tab (o Mayús+Tab desde el primero) cierra; la tecla sigue su curso desde el botón del campo.
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
    if (event.target === (event.shiftKey ? stops[0] : stops[stops.length - 1])) onClose();
  };

  const items = presetItems(presets);
  return (
    <div className="timepicker" role="dialog" aria-label={labels.title} onKeyDown={onKeyDown}>
      <div className="timepicker__readout" aria-hidden>
        <Clock size={18} />
        <span>{value === null ? '--:--' : clockText(value)}</span>
      </div>
      {items.length > 0 && (
        <div className="chips timepicker__presets" role="group" aria-label={labels.presets}>
          {items.map(({ minutes: at, label }) => (
            <button
              key={at}
              type="button"
              className={`chip ${at === value ? 'is-active' : ''}`}
              aria-pressed={at === value}
              disabled={!overlapsRange(at, at, range)}
              onClick={() => onPick(at, true)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="timepicker__columns">
        <TimeColumn
          id={`${id}-h`}
          label={labels.hours}
          options={hours}
          selected={value === null ? -1 : Math.floor(value / 60)}
          active={hour}
          listRef={hoursRef}
          onActive={setHour}
          onChoose={chooseHour}
          onSide={focusSide}
        />
        <span className="timepicker__colon" aria-hidden>
          :
        </span>
        <TimeColumn
          id={`${id}-m`}
          label={labels.minutes}
          options={minutes}
          selected={minuteValues.indexOf(selectedMinute ?? -1)}
          active={minuteValues.indexOf(minute)}
          listRef={minutesRef}
          onActive={(index) => setMinute(minuteValues[index])}
          onChoose={chooseMinute}
          onSide={focusSide}
        />
      </div>
    </div>
  );
}

interface TimeColumnProps {
  id: string;
  label: string;
  options: SelectOption[];
  /** Índice elegido (-1: ninguno). */
  selected: number;
  /** Índice activo (teclado). */
  active: number;
  listRef: RefObject<HTMLUListElement | null>;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
  onSide: (side: Side) => void;
}

/** Una columna (horas o minutos): lista con la opción activa siempre centrada, como una rueda. */
function TimeColumn({ id, label, options, selected, active, listRef, onActive, onChoose, onSide }: TimeColumnProps) {
  // Centra la opción activa moviendo solo la lista (scrollIntoView también desplazaría la página).
  // La lista siempre está montada y la opción activa siempre es una de las suyas.
  useEffect(() => {
    const list = listRef.current as HTMLUListElement;
    const item = list.children[active] as HTMLElement;
    list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
  }, [active, listRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onSide(event.key === 'ArrowLeft' ? 'hours' : 'minutes');
      return;
    }
    // Las mismas teclas que la lista de `Select`; Escape y Tab los atiende el selector completo.
    const action = listKeyAction(event.key, options, active);
    if (action?.kind === 'move') onActive(action.index);
    else if (action?.kind === 'choose') onChoose(active);
    else return;
    event.preventDefault();
  };

  return (
    <div className="timepicker__column">
      <span id={`${id}-label`} className="timepicker__heading">
        {label}
      </span>
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={0}
        className="timepicker__list"
        aria-labelledby={`${id}-label`}
        aria-activedescendant={`${id}-${active}`}
        onKeyDown={onKeyDown}
      >
        {options.map((item, index) => (
          <li
            key={item.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === selected}
            aria-disabled={item.disabled || undefined}
            className={`timepicker__option ${index === selected ? 'is-selected' : ''} ${index === active ? 'is-active' : ''}`}
            onClick={() => onChoose(index)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
