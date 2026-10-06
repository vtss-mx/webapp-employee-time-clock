import { ArchiveRestore, SearchX, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { t, useLocale, useT } from '../../i18n';
import type { Restored, SoftDeleted } from '../../types';
import { formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import type { EmptyStateProps } from '../ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { useRestore, type RestoreQuestion } from './useRestore';

/*
 * Papelera («Eliminados»): piezas comunes a todos los listados y detalles con registros eliminados (decisión
 * del dueño del producto: todo borrado es lógico y se restaura durante 1 año). Una fila eliminada dice cuándo
 * y quién la eliminó y ofrece «Restaurar»; nunca editar, cambiar su estado ni eliminarla otra vez.
 */

/** «Se eliminó el 5 oct 2026, 10:00 por ana@empresa.com» (en el idioma activo; sin autor, solo la fecha). */
export function deletedText({ deleted_at, deleted_by }: SoftDeleted): string {
  const date = formatDateTime(deleted_at);
  return deleted_by ? t('ui.trash.deletedBy', { date, email: deleted_by }) : t('ui.trash.deletedOn', { date });
}

/**
 * Nota de la confirmación al eliminar: va a «Eliminados» y se restaura durante 1 año (`trash`, si el registro
 * pide otra concordancia: «Eliminadas»); a una persona, además, su rostro y sus fotos se borran para siempre.
 */
export function deleteNote({ person = false, trash = t('ui.trash.note') }: { person?: boolean; trash?: string } = {}): string {
  return person ? `${trash} ${t('ui.trash.personNote')}` : trash;
}

/** Encabezados de las columnas que agrega «Eliminados» a una tabla: cuándo y quién, y «Restaurar». */
export const trashColumns = () => [t('ui.trash.column'), t('ui.trash.actions')];

interface ListView {
  trash: boolean;
  appliedSearch: string;
  filtered: boolean;
}

/**
 * Vacío de un listado con «Eliminados»: sin nada eliminado («Nada eliminado»), sin coincidencias con la búsqueda
 * o el filtro (`noMatch`, si el listado busca) o el vacío propio de la pantalla.
 */
export function listEmpty(list: ListView, { empty, noMatch }: { empty: EmptyStateProps; noMatch?: EmptyStateProps }): EmptyStateProps {
  if (list.trash && !list.appliedSearch) return { icon: <Trash2 />, title: t('ui.trash.empty'), description: t('ui.trash.emptyDescription'), compact: empty.compact };
  return noMatch && list.filtered ? noMatch : empty;
}

/**
 * Subtítulo de un listado con «Eliminados»: «Cargando…», lo vigente (`live`: «12 registrados») o cuántos hay en
 * «Eliminados» (`deleted`, si el registro pide otra concordancia: «2 eliminadas»).
 */
export function listSubtitle(
  list: ListView & { data: unknown; total: number },
  live: (count: number) => string,
  deleted = (count: number) => t('ui.trash.count', { count }),
): string {
  if (!list.data) return t('common.states.loading');
  return list.trash ? deleted(list.total) : live(list.total);
}

/** Sin coincidencias con la búsqueda o el filtro: «Sin resultados» y qué probar (los textos de cada listado). */
export const noMatchEmpty = (title: string, description: string): EmptyStateProps => ({ icon: <SearchX />, title, description });

/** Cuándo y quién lo eliminó, en una línea discreta (tarjetas de «Eliminados»). */
export function DeletedNote({ record }: { record: SoftDeleted }) {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce
  return <small className="muted">{deletedText(record)}</small>;
}

interface RestoreButtonProps {
  /** Nombre del registro (lo lee el lector de pantalla: «Restaurar Ana Ruiz»). */
  name: string;
  busy: boolean;
  disabled?: boolean;
  onRestore: () => void;
  size?: 'sm' | 'md';
}

/** «Restaurar»: regresa el registro de «Eliminados» (pregunta antes, con `useRestore`). */
export function RestoreButton({ name, busy, disabled = false, onRestore, size = 'sm' }: RestoreButtonProps) {
  const t = useT();
  return (
    <Button size={size} variant={size === 'sm' ? 'secondary' : 'primary'} icon={<ArchiveRestore size={size === 'sm' ? 16 : 18} />} loading={busy} disabled={disabled || busy} aria-label={t('ui.trash.restoreLabel', { name })} onClick={onRestore}>
      {t('ui.trash.restore')}
    </Button>
  );
}

/**
 * Las dos celdas que «Eliminados» agrega a una fila de tabla: cuándo y quién, y «Restaurar». `restorable={false}`
 * deja la celda de acciones vacía: el backend dijo que quien lo ve no puede restaurarlo (p. ej. un documento que
 * subió la plataforma, visto por la empresa); la app nunca lo deduce.
 */
export function TrashCells({ record, restorable = true, ...restore }: RestoreButtonProps & { record: SoftDeleted; restorable?: boolean }) {
  const t = useT();
  return (
    <>
      <td data-label={t('ui.trash.column')} className="table__wide">
        {deletedText(record)}
      </td>
      <td className="table__actions">{restorable && <RestoreButton {...restore} />}</td>
    </>
  );
}

interface DeletedBannerProps {
  record: SoftDeleted;
  /** «Empleado eliminado», «Empresa eliminada»... */
  title: string;
  /** «Restaurar» (o, en una pantalla secundaria, el enlace al detalle). */
  action: ReactNode;
}

/** Aviso del detalle de un registro eliminado: qué es, cuándo y quién lo eliminó, y cómo regresarlo. */
export function DeletedBanner({ record, title, action }: DeletedBannerProps) {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce
  return (
    <div className="callout callout--danger" role="status">
      <span className="icon-tile icon-tile--danger">
        <Trash2 size={22} />
      </span>
      <div className="callout__body">
        <strong>{title}</strong>
        <p className="muted small">{deletedText(record)}</p>
      </div>
      {action}
    </div>
  );
}

interface DeletedRecordPageProps<T> {
  /** El registro eliminado (su id, cuándo y quién lo eliminó). */
  record: SoftDeleted & { id: number };
  /** Nombre del registro (título de la pantalla) y su línea secundaria. */
  name: string;
  subtitle?: ReactNode;
  backTo: string;
  backLabel: string;
  /** Título del aviso: «Empleado eliminado», «Empresa eliminada»... */
  banner: string;
  /** Restaurarlo (`POST …/restore`), qué se pregunta antes y qué hacer con el registro de vuelta. */
  restore: () => Promise<Restored<T>>;
  question: () => RestoreQuestion;
  onRestored: (item: T) => void;
  /** Lo que se puede consultar del registro (sin acciones ni secciones que dependan de él). */
  children?: ReactNode;
}

/**
 * Detalle de un registro eliminado: su encabezado, el aviso con «Restaurar» y solo lo que se puede leer. No
 * ofrece editar, cambiar el estado ni eliminar, y no pide sus secciones (el backend las responde 404). Al
 * restaurarlo, `onRestored` muestra el registro vigente.
 */
export function DeletedRecordPage<T>({ record, name, subtitle, backTo, backLabel, banner, restore, question, onRestored, children }: DeletedRecordPageProps<T>) {
  const { restoring, restore: run } = useRestore();
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={name} subtitle={subtitle} backTo={backTo} backLabel={backLabel} />
        <PanelSection>
          <DeletedBanner
            record={record}
            title={banner}
            action={<RestoreButton size="md" name={name} busy={restoring !== null} onRestore={() => void run(record.id, restore, question, onRestored)} />}
          />
        </PanelSection>
        {children}
      </Panel>
    </div>
  );
}
