import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { foldText } from '../../utils/phone';
import { Floating } from './Floating';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Ícono de la opción (también se muestra en el control cuando está elegida). */
  icon?: ReactNode;
  /** Segunda línea de la opción (una aclaración breve). */
  description?: string;
  disabled?: boolean;
  /** Globo informativo (p. ej. el nombre técnico de una cámara). */
  title?: string;
}

export interface SelectProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  /** Nombre accesible del control (cuando no hay una etiqueta visible). */
  'aria-label'?: string;
  /** Etiqueta visible que nombra al control (en lugar de aria-label). */
  'aria-labelledby'?: string;
  id?: string;
  /** Ícono fijo del control (si la opción elegida no trae el suyo). */
  icon?: ReactNode;
  /** Texto cuando el valor no corresponde a ninguna opción. */
  placeholder?: string;
  disabled?: boolean;
  /** md: alto de los controles; sm: compacto (p. ej. en el paginador). */
  size?: 'md' | 'sm';
  /** light: sobre superficies claras; dark: sobre la cámara u otras superficies oscuras. */
  tone?: 'light' | 'dark';
  /** Ancho de la lista: el del control o el de su contenido. */
  menuWidth?: 'control' | 'content';
  /** Contenido propio de cada opción (por omisión: ícono, texto, aclaración y palomita). */
  renderOption?: (option: SelectOption<T>, state: { selected: boolean; active: boolean }) => ReactNode;
  /** Búsqueda dentro de la lista (listas largas, p. ej. países): texto de ayuda y "sin resultados". */
  searchable?: boolean | { placeholder?: string; empty?: string };
  className?: string;
}

/** Opciones cuyo texto o aclaración contienen lo escrito (sin distinguir acentos ni mayúsculas). */
export function filterOptions<T extends string>(options: ReadonlyArray<SelectOption<T>>, query: string): ReadonlyArray<SelectOption<T>> {
  const term = foldText(query.trim());
  return term ? options.filter((o) => foldText(`${o.label} ${o.description ?? ''} ${o.value}`).includes(term)) : options;
}

/** Índice de la siguiente opción habilitada en la dirección indicada (se detiene en los extremos). */
function step<T extends string>(options: ReadonlyArray<SelectOption<T>>, from: number, delta: 1 | -1): number {
  for (let i = from + delta; i >= 0 && i < options.length; i += delta) if (!options[i].disabled) return i;
  return from;
}

function edge<T extends string>(options: ReadonlyArray<SelectOption<T>>, last: boolean): number {
  return step(options, last ? options.length : -1, last ? -1 : 1);
}

type ListAction = { kind: 'move'; index: number } | { kind: 'choose' } | { kind: 'close' } | { kind: 'tab' } | null;

/**
 * Qué hace cada tecla con la lista abierta: moverse, elegir, cerrar o saltar por letra. Con
 * búsqueda (`typeahead: false`) las letras, el espacio, Inicio y Fin escriben en el buscador.
 */
export function listKeyAction<T extends string>(key: string, options: ReadonlyArray<SelectOption<T>>, active: number, { typeahead = true } = {}): ListAction {
  const moves: Record<string, () => number> = {
    ArrowDown: () => step(options, active, 1),
    ArrowUp: () => step(options, active, -1),
    ...(typeahead && { Home: () => edge(options, false), End: () => edge(options, true) }),
  };
  if (key in moves) return { kind: 'move', index: moves[key]() };
  if (key === 'Enter' || (typeahead && key === ' ')) return { kind: 'choose' };
  if (key === 'Escape') return { kind: 'close' };
  if (key === 'Tab') return { kind: 'tab' };
  if (!typeahead || key.length !== 1) return null;
  // Salto por letra: la siguiente opción habilitada que empieza con ella.
  const letter = key.toLowerCase();
  const order = [...options.keys()].map((i) => (active + 1 + i) % options.length);
  const match = order.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(letter));
  return match === undefined ? null : { kind: 'move', index: match };
}

/**
 * Estado y teclado de la lista: abrir en la opción elegida, moverse, elegir y cerrar (devolviendo
 * el foco al control). Separado del dibujo para mantener cada parte simple.
 */
function useSelectList<T extends string>(
  all: ReadonlyArray<SelectOption<T>>,
  options: ReadonlyArray<SelectOption<T>>,
  value: T,
  onChange: (value: T) => void,
  { disabled, searchable, onOpen }: { disabled: boolean; searchable: boolean; onOpen: () => void },
) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedIndex = all.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? all[selectedIndex] : null;

  useDismissOnOutsidePointer([triggerRef, menuRef], open, () => setOpen(false));

  // Al abrir: foco en el buscador o en la lista (lectores de pantalla y teclado) y la opción activa a la vista.
  useEffect(() => {
    if (open) (searchable ? searchRef : listRef).current?.focus();
  }, [open, searchable]);
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    if (disabled) return;
    onOpen(); // la búsqueda empieza vacía: se ven todas las opciones
    setActive(selectedIndex >= 0 && !all[selectedIndex].disabled ? selectedIndex : edge(all, false));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close();
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    const action = listKeyAction(event.key, options, active, { typeahead: !searchable });
    if (!action) return;
    if (action.kind !== 'tab') event.preventDefault();
    if (action.kind === 'move') setActive(action.index);
    else if (action.kind === 'choose') choose(active);
    else if (action.kind === 'tab') close(false);
    else {
      event.stopPropagation(); // Escape: no cierra el popup que contiene la lista
      close();
    }
  };

  return { open, active, setActive, selected, show, close, choose, onTriggerKey, onListKey, triggerRef, menuRef, listRef, searchRef };
}

/**
 * Lista desplegable propia (sin el menú nativo del sistema): misma apariencia en todos los
 * navegadores y personalizable (íconos, aclaraciones, tamaño, tono, ancho, contenido por opción y
 * tokens CSS --select-*). La lista se abre en una capa flotante (ningún panel la recorta).
 *
 * Teclado: flechas, Inicio/Fin, Enter o Espacio para elegir, Escape o Tab para cerrar y escribir
 * una letra para saltar a la opción que empieza con ella. Mismo patrón de accesibilidad que un
 * botón con lista (aria-haspopup="listbox").
 */
export function Select<T extends string = string>(props: SelectProps<T>) {
  const { value, options, onChange, id, renderOption } = props;
  const baseId = useId();
  const ids = { list: `${baseId}-list`, value: `${baseId}-value`, label: `${baseId}-label` };
  const [query, setQuery] = useState('');
  const visible = props.searchable ? filterOptions(options, query) : options;
  const list = useSelectList(options, visible, value, onChange, { disabled: Boolean(props.disabled), searchable: Boolean(props.searchable), onOpen: () => setQuery('') });
  const view = selectView(props, list.selected, ids.label);
  const search = props.searchable ? (
    <SelectSearch
      inputRef={list.searchRef}
      listId={ids.list}
      activeId={visible.length ? `${baseId}-opt-${list.active}` : undefined}
      options={typeof props.searchable === 'object' ? props.searchable : {}}
      query={query}
      empty={visible.length === 0}
      onQuery={(next) => {
        setQuery(next);
        list.setActive(edge(filterOptions(options, next), false));
      }}
      onKeyDown={list.onListKey}
    />
  ) : null;

  return (
    <span className={view.className}>
      {props['aria-label'] && (
        <span id={ids.label} hidden>
          {props['aria-label']}
        </span>
      )}
      {view.icon && <span className="select__icon">{view.icon}</span>}
      <button
        ref={list.triggerRef}
        id={id}
        type="button"
        className="select__control"
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-controls={list.open ? ids.list : undefined}
        aria-labelledby={view.labelledBy && `${view.labelledBy} ${ids.value}`}
        title={list.selected?.title}
        onClick={() => (list.open ? list.close() : list.show())}
        onKeyDown={list.onTriggerKey}
      >
        <span id={ids.value} className={view.valueClass}>
          {view.valueText}
        </span>
      </button>
      <ChevronDown size={18} className={`select__chevron ${list.open ? 'is-flipped' : ''}`} aria-hidden />
      {list.open && (
        <SelectList
          anchorRef={list.triggerRef}
          menuRef={list.menuRef}
          listRef={list.listRef}
          listId={ids.list}
          baseId={baseId}
          tone={props.tone ?? 'light'}
          matchWidth={(props.menuWidth ?? 'control') === 'control'}
          labelledBy={view.labelledBy}
          search={search}
          options={visible}
          value={value}
          active={list.active}
          renderOption={renderOption}
          onActive={list.setActive}
          onChoose={list.choose}
          onKeyDown={list.onListKey}
        />
      )}
    </span>
  );
}

/** Lo que muestra el control según sus opciones de personalización (tamaño, tono, ícono...). */
function selectView<T extends string>(props: SelectProps<T>, selected: SelectOption<T> | null, labelId: string) {
  const icon = selected?.icon ?? props.icon;
  const classes = ['select', `select--${props.size ?? 'md'}`, `select--${props.tone ?? 'light'}`, icon && 'select--with-icon', props.className];
  return {
    icon,
    className: classes.filter(Boolean).join(' '),
    labelledBy: props['aria-labelledby'] ?? (props['aria-label'] ? labelId : undefined),
    valueText: selected?.label ?? props.placeholder ?? 'Selecciona una opción',
    valueClass: selected ? 'select__value' : 'select__value select__value--placeholder',
  };
}

interface SelectListProps<T extends string> {
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  listRef: RefObject<HTMLUListElement | null>;
  listId: string;
  baseId: string;
  tone: 'light' | 'dark';
  matchWidth: boolean;
  labelledBy?: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T;
  active: number;
  renderOption?: SelectProps<T>['renderOption'];
  /** Buscador sobre la lista (si la lista lo usa). */
  search: ReactNode;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** La lista abierta, en una capa flotante (ningún panel la recorta). */
function SelectList<T extends string>(props: SelectListProps<T>) {
  const { options, value, active, baseId, renderOption } = props;
  return (
    <Floating anchorRef={props.anchorRef} floatingRef={props.menuRef} className={`select__menu select__menu--${props.tone}`} matchWidth={props.matchWidth}>
      {props.search}
      <ul
        ref={props.listRef}
        id={props.listId}
        role="listbox"
        tabIndex={props.search ? undefined : -1}
        aria-labelledby={props.labelledBy}
        aria-activedescendant={options.length ? `${baseId}-opt-${active}` : undefined}
        onKeyDown={props.search ? undefined : props.onKeyDown}
      >
        {options.map((option, index) => {
          const state = { selected: option.value === value, active: index === active };
          return (
            <li
              key={option.value}
              id={`${baseId}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={state.selected}
              aria-disabled={option.disabled || undefined}
              title={option.title}
              className={`select__option ${state.active ? 'is-active' : ''} ${state.selected ? 'is-selected' : ''}`}
              onPointerMove={() => !option.disabled && props.onActive(index)}
              onClick={() => props.onChoose(index)}
            >
              {renderOption ? renderOption(option, state) : <DefaultOption option={option} selected={state.selected} />}
            </li>
          );
        })}
      </ul>
    </Floating>
  );
}

/** Opción por omisión: ícono, texto, aclaración y palomita si está elegida. */
function DefaultOption<T extends string>({ option, selected }: { option: SelectOption<T>; selected: boolean }) {
  return (
    <>
      {option.icon && <span className="select__option-icon">{option.icon}</span>}
      <span className="select__option-text">
        <span>{option.label}</span>
        {option.description && <small>{option.description}</small>}
      </span>
      {selected && <Check size={16} className="select__check" aria-hidden />}
    </>
  );
}

interface SelectSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  activeId?: string;
  options: { placeholder?: string; empty?: string };
  query: string;
  empty: boolean;
  onQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Buscador de la lista (patrón combobox: el foco queda en él y las flechas recorren las opciones). */
function SelectSearch({ inputRef, listId, activeId, options, query, empty, onQuery, onKeyDown }: SelectSearchProps) {
  const placeholder = options.placeholder ?? 'Buscar...';
  return (
    <>
      <div className="select__search">
        <Search size={16} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {empty && (
        <p className="select__empty" role="status">
          {options.empty ?? 'Sin resultados'}
        </p>
      )}
    </>
  );
}
