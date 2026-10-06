import { CircleCheck, CircleMinus, CircleSlash } from 'lucide-react';
import type { ReactNode } from 'react';
import { t as translate, useT } from '../i18n';
import type { BulkOutcome, BulkResult, BulkResultCode } from '../types';
import type { MessageInput } from './MessageDialog';
import { DeletedMark } from './ui/DeletedMark';

/** Nombres que se muestran por grupo; del resto solo se dice cuántos más son. */
const NAMES_SHOWN = 8;

/** Cómo se dice cada resultado en la pantalla que lo pidió (p. ej. "Asignado" / "Ya lo tenían"). */
export interface BulkCopy {
  /** Título del popup ("Turno asignado", "Vacaciones registradas"). */
  title: string;
  done: string;
  unchanged: string;
  skipped: string;
}

const ICONS: Record<BulkResultCode, ReactNode> = {
  DONE: <CircleCheck size={18} aria-hidden />,
  UNCHANGED: <CircleMinus size={18} aria-hidden />,
  SKIPPED: <CircleSlash size={18} aria-hidden />,
};

function Group({ code, title, outcomes }: { code: BulkResultCode; title: string; outcomes: BulkOutcome[] }) {
  const t = useT();
  if (!outcomes.length) return null;
  const shown = code === 'SKIPPED' ? outcomes : outcomes.slice(0, NAMES_SHOWN);
  const rest = outcomes.length - shown.length;
  return (
    <section className={`bulk-result__group bulk-result__group--${code.toLowerCase()}`}>
      <h3 className="bulk-result__title">
        {ICONS[code]} {title} <span className="badge badge--plain badge--muted">{outcomes.length}</span>
      </h3>
      <ul className="bulk-result__list">
        {shown.map((outcome) => (
          <li key={outcome.employee.id}>
            <strong>{outcome.employee.full_name}</strong> <small className="muted">{t('dialogs.bulk.employeeNumber', { number: outcome.employee.employee_number })}</small>
            <DeletedMark deleted={outcome.employee.deleted} />
            {outcome.message && <span className="bulk-result__reason">{outcome.message}</span>}
          </li>
        ))}
        {rest > 0 && <li className="muted">{t('dialogs.bulk.more', { count: rest })}</li>}
      </ul>
    </section>
  );
}

/** Lo que pasó con cada empleado de una operación masiva: hechos, sin cambios y omitidos (con su motivo). */
export function BulkResultSummary({ result, copy }: { result: BulkResult; copy: BulkCopy }) {
  const by = (code: BulkResultCode) => result.results.filter((outcome) => outcome.result === code);
  return (
    <div className="bulk-result">
      <Group code="SKIPPED" title={copy.skipped} outcomes={by('SKIPPED')} />
      <Group code="DONE" title={copy.done} outcomes={by('DONE')} />
      <Group code="UNCHANGED" title={copy.unchanged} outcomes={by('UNCHANGED')} />
    </div>
  );
}

/**
 * El popup del resultado: de éxito si nadie se omitió; si no, de advertencia con los motivos primero.
 * Se arma en el idioma activo: para que el popup abierto siga un cambio de idioma se pasa como
 * función (`feedback.show(() => bulkResultMessage(result, copy()))`).
 */
export function bulkResultMessage(result: BulkResult, copy: BulkCopy): MessageInput {
  const parts = [`${copy.done}: ${result.done}`, result.unchanged ? `${copy.unchanged}: ${result.unchanged}` : '', result.skipped ? `${copy.skipped}: ${result.skipped}` : ''];
  return {
    variant: result.skipped ? 'warning' : 'success',
    title: result.skipped ? translate('dialogs.bulk.withOmissions', { title: copy.title }) : copy.title,
    text: parts.filter(Boolean).join(' · '),
    body: <BulkResultSummary result={result} copy={copy} />,
    wide: true,
  };
}
