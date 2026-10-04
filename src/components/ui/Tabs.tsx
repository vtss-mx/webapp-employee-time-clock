import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon?: ReactNode;
  /** Contador junto al nombre (p. ej. pendientes); 0 o null no se muestra. */
  count?: number | null;
  /** Qué cuenta, para el lector de pantalla ("pendientes" → "Solicitudes, 3 pendientes"). */
  countLabel?: string;
}

interface TabsProps<K extends string> {
  items: ReadonlyArray<TabItem<K>>;
  value: K;
  onChange: (key: K) => void;
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  /** Base de los ids que unen cada pestaña con su panel (`useId()` de la pantalla). */
  idBase: string;
  className?: string;
}

const tabId = (idBase: string, key: string) => `${idBase}-tab-${key}`;
const panelId = (idBase: string, key: string) => `${idBase}-panel-${key}`;

/** Flechas (con vuelta), Inicio y Fin: a qué pestaña lleva cada tecla; null si no es de navegación. */
function nextIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') return (index + (key === 'ArrowLeft' ? -1 : 1) + count) % count;
  if (key === 'Home') return 0;
  return key === 'End' ? count - 1 : null;
}

/**
 * Pestañas accesibles (patrón `tablist` de WAI-ARIA): la elegida es la única con foco de tabulador,
 * las flechas, Inicio y Fin cambian de pestaña y cada una nombra su panel (`TabPanel`). Mismo estilo
 * que las demás pestañas de la app (`.tabs`); en teléfono ocupan el ancho con el ícono sobre el nombre.
 */
export function Tabs<K extends string>({ items, value, onChange, label, idBase, className = '' }: TabsProps<K>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = nextIndex(
      event.key,
      items.findIndex((item) => item.key === value),
      items.length,
    );
    if (index === null) return;
    event.preventDefault();
    onChange(items[index].key);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index].focus();
  };

  return (
    <div className={`tabs ${className}`.trim()} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={tabId(idBase, item.key)}
            aria-label={item.count ? [`${item.label},`, item.count, item.countLabel].filter(Boolean).join(' ') : undefined}
            aria-selected={selected}
            aria-controls={panelId(idBase, item.key)}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'is-active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.icon} {item.label}
            {item.count ? (
              <span className="tab__count" aria-hidden>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Contenido de la pestaña elegida, nombrado por ella. */
export function TabPanel({ idBase, tab, children }: { idBase: string; tab: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(idBase, tab)} aria-labelledby={tabId(idBase, tab)} className="tab-panel">
      {children}
    </div>
  );
}
