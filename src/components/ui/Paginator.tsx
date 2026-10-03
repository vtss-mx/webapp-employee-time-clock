import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { config } from '../../utils/config';
import { Select } from './Select';

export type PageItem = number | 'gap-start' | 'gap-end';

/**
 * Páginas a mostrar: siempre la primera y la última, `siblings` a cada lado de la actual y "…"
 * donde se salta más de una. Siempre el mismo número de casillas (el paginador no cambia de
 * ancho al moverse de página).
 */
export function pageItems(page: number, totalPages: number, siblings = 1): PageItem[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (totalPages <= siblings * 2 + 5) return range(1, totalPages);
  const start = Math.max(Math.min(page - siblings, totalPages - siblings * 2 - 2), 3);
  const end = Math.min(Math.max(page + siblings, siblings * 2 + 3), totalPages - 2);
  return [1, start > 3 ? 'gap-start' : 2, ...range(start, end), end < totalPages - 2 ? 'gap-end' : totalPages - 1, totalPages];
}

export interface PaginatorLabels {
  /** Nombre accesible de la navegación. */
  navigation: string;
  /** Rango visible: "Mostrando 11–20 de 57 empleados". */
  range: (from: number, to: number, total: number, noun: string) => ReactNode;
  perPage: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  /** Nombre accesible de cada número de página. */
  page: (page: number) => string;
  /** Resumen cuando no caben los números (teléfono) o se ocultan: "Página 2 de 6". */
  status: (page: number, totalPages: number) => ReactNode;
}

export const DEFAULT_PAGINATOR_LABELS: PaginatorLabels = {
  navigation: 'Paginación',
  range: (from, to, total, noun) => (
    <>
      Mostrando <strong>{from === to ? from : `${from}–${to}`}</strong> de <strong>{total}</strong> {noun}
    </>
  ),
  perPage: 'Por página',
  first: 'Primera página',
  previous: 'Página anterior',
  next: 'Página siguiente',
  last: 'Última página',
  page: (page) => `Página ${page}`,
  status: (page, totalPages) => (
    <>
      Página <strong>{page}</strong> de <strong>{totalPages}</strong>
    </>
  ),
};

export type PaginatorPart = 'range' | 'sizes' | 'edges' | 'pages';

/** Personalización del paginador (todo opcional; por omisión, la barra completa). */
export interface PaginatorOptions {
  /** Opciones de "por página" (por omisión las de la configuración: 10, 20, 30, 40 y 50). */
  sizes?: readonly number[];
  /** Páginas a cada lado de la actual (por omisión 1). */
  siblings?: number;
  /** Partes visibles: rango, "por página", primera/última y números (por omisión todas). */
  show?: Partial<Record<PaginatorPart, boolean>>;
  /** Cómo se llaman los elementos en el rango (singular y plural). */
  noun?: { one: string; other: string };
  labels?: Partial<PaginatorLabels>;
  /** default: barra de un listado; compact: dentro de un panel (bitácoras). */
  variant?: 'default' | 'compact';
  className?: string;
}

export interface PaginatorProps extends PaginatorOptions {
  page: number;
  /** Elementos por página. */
  size: number;
  /** Total de elementos (sin paginar). */
  total: number;
  onPage: (page: number) => void;
  /** Sin él no se ofrece cambiar los elementos por página. */
  onSize?: (size: number) => void;
  /** Mientras carga, los botones no responden (evita saltos dobles). */
  loading?: boolean;
}

/**
 * Paginador ÚNICO de la aplicación: rango ("Mostrando 11–20 de 57"), elementos por página (lista
 * propia `Select`), primera/anterior, números con "…", siguiente/última. Todo se personaliza:
 * textos, partes visibles, páginas vecinas, opciones de tamaño, variante y tokens CSS --pager-*.
 * Si el espacio es angosto (teléfono o un panel estrecho) los números se cambian por "Página 2 de 6".
 */
export function Paginator(props: PaginatorProps) {
  const { page, size, total, loading = false, onPage, onSize } = props;
  if (total <= 0) return null;
  const labels = { ...DEFAULT_PAGINATOR_LABELS, ...props.labels };
  const show = { range: true, sizes: true, edges: true, pages: true, ...props.show };
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(page, 1), totalPages);
  const go = (target: number) => {
    if (!loading && target !== current && target >= 1 && target <= totalPages) onPage(target);
  };
  const atStart = current <= 1 || loading;
  const atEnd = current >= totalPages || loading;
  const classes = ['pager', `pager--${props.variant ?? 'default'}`, loading && 'is-loading', !show.pages && 'pager--no-pages', props.className];

  return (
    <nav className={classes.filter(Boolean).join(' ')} aria-label={labels.navigation} aria-busy={loading || undefined}>
      <div className="pager__inner">
        {show.range && <PagerRange labels={labels} current={current} size={size} total={total} noun={props.noun} />}
        {show.sizes && onSize && <PageSizeSelect label={labels.perPage} size={size} sizes={props.sizes ?? config.pageSizes} onSize={onSize} />}
        <div className="pager__nav">
          {show.edges && <PagerButton label={labels.first} icon={<ChevronsLeft size={18} />} disabled={atStart} onClick={() => go(1)} />}
          <PagerButton label={labels.previous} icon={<ChevronLeft size={18} />} disabled={atStart} onClick={() => go(current - 1)} />
          {show.pages && <PageNumbers current={current} totalPages={totalPages} siblings={props.siblings ?? 1} label={labels.page} disabled={loading} onPage={go} />}
          <span className="pager__status">{labels.status(current, totalPages)}</span>
          <PagerButton label={labels.next} icon={<ChevronRight size={18} />} disabled={atEnd} onClick={() => go(current + 1)} />
          {show.edges && <PagerButton label={labels.last} icon={<ChevronsRight size={18} />} disabled={atEnd} onClick={() => go(totalPages)} />}
        </div>
      </div>
    </nav>
  );
}

interface PagerRangeProps {
  labels: PaginatorLabels;
  current: number;
  size: number;
  total: number;
  noun?: { one: string; other: string };
}

function PagerRange({ labels, current, size, total, noun }: PagerRangeProps) {
  const from = (current - 1) * size + 1;
  const to = Math.min(total, current * size);
  const word = total === 1 ? (noun?.one ?? 'resultado') : (noun?.other ?? 'resultados');
  return (
    <p className="pager__range" aria-live="polite">
      {labels.range(from, to, total, word)}
    </p>
  );
}

function PageSizeSelect({ label, size, sizes, onSize }: { label: string; size: number; sizes: readonly number[]; onSize: (size: number) => void }) {
  const labelId = useId();
  // El tamaño actual siempre aparece entre las opciones (aunque no sea una de las configuradas).
  const values = sizes.includes(size) ? sizes : [...sizes, size].sort((a, b) => a - b);
  return (
    <div className="pager__sizes">
      <span id={labelId}>{label}</span>
      <Select
        size="sm"
        className="pager__size"
        aria-labelledby={labelId}
        value={String(size)}
        options={values.map((n) => ({ value: String(n), label: String(n) }))}
        onChange={(value) => onSize(Number(value))}
      />
    </div>
  );
}

interface PageNumbersProps {
  current: number;
  totalPages: number;
  siblings: number;
  label: (page: number) => string;
  disabled: boolean;
  onPage: (page: number) => void;
}

function PageNumbers({ current, totalPages, siblings, label, disabled, onPage }: PageNumbersProps) {
  return (
    <>
      {pageItems(current, totalPages, siblings).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={`pager__btn pager__page ${item === current ? 'is-current' : ''}`}
            aria-label={label(item)}
            aria-current={item === current ? 'page' : undefined}
            disabled={disabled && item !== current}
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="pager__gap" aria-hidden>
            …
          </span>
        ),
      )}
    </>
  );
}

function PagerButton({ label, icon, disabled, onClick }: { label: string; icon: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="pager__btn pager__step" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}

/** Lo que el paginador necesita de un listado de `usePagedList` / `useSearchList`. */
export interface PagerState {
  page: number;
  size: number;
  total: number;
  loading: boolean;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
}

/** El paginador conectado a un listado (página, tamaño y carga), con la misma personalización. */
export function ListPaginator({ list, ...options }: { list: PagerState } & PaginatorOptions) {
  return <Paginator {...options} page={list.page} size={list.size} total={list.total} loading={list.loading} onPage={list.setPage} onSize={list.setSize} />;
}
