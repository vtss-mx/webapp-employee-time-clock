import { Bookmark, FileSpreadsheet, Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ReportAnswer } from '../../types';
import { Button } from '../ui/Button';
import { ReportTable } from './ReportTable';

export interface AnswerActions {
  /** Ocupado: 'export', 'save', 'feedback' o null. */
  busy: string | null;
  onExport: () => void;
  /** Sin `onSave` no se ofrece guardar (p. ej. un reporte que ya está guardado). */
  onSave?: () => void;
  /** «¿Te sirvió?»; sin él no se pregunta (vista previa del constructor). */
  onFeedback?: (helpful: boolean) => void;
  /** «¿Te referías a…?»: aclarar de qué datos se trata (el asistente aprende). */
  onAlternative?: (dataset: string) => void;
  /** Ya dijo si le sirvió: no se vuelve a preguntar. */
  rated?: boolean;
}

/**
 * Una respuesta del asistente: el texto (siempre), lo que destaca de los datos, cómo entendió la
 * pregunta, la vista previa y lo que se puede hacer con ella (Excel, guardar, aclarar, calificar).
 */
export function AnswerCard({ answer, actions, learned = [] }: { answer: ReportAnswer; actions: AnswerActions; learned?: string[] }) {
  const { busy, onAlternative, onFeedback, onSave } = actions;
  const notes = [...learned.map((item) => `Aprendí: ${item}`), ...answer.highlights];
  return (
    <article className="report-answer">
      <p className="report-answer__text">{answer.answer}</p>
      {notes.length > 0 && (
        <ul className="report-answer__notes">
          {notes.map((note) => (
            <li key={note}>
              <Lightbulb size={16} /> {note}
            </li>
          ))}
        </ul>
      )}
      {answer.understood.length > 0 && (
        <ul className="report-tags" aria-label="Cómo entendí tu pregunta">
          {answer.understood.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {answer.preview && <ReportTable preview={answer.preview} />}
      {onAlternative && answer.alternatives.length > 0 && (
        <div className="report-answer__alternatives">
          <span className="muted small">{answer.plan ? '¿O te referías a…?' : '¿De qué datos hablas?'}</span>
          <div className="chips">
            {answer.alternatives.map((option) => (
              <button key={option.code} type="button" className="chip" disabled={busy !== null} onClick={() => onAlternative(option.code)}>
                {option.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {answer.plan && (
        <div className="report-answer__actions">
          <Button variant="primary" size="sm" icon={<FileSpreadsheet size={16} />} loading={busy === 'export'} disabled={busy !== null} onClick={actions.onExport}>
            Exportar a Excel
          </Button>
          {onSave && (
            <Button variant="secondary" size="sm" icon={<Bookmark size={16} />} loading={busy === 'save'} disabled={busy !== null} onClick={onSave}>
              Guardar
            </Button>
          )}
          {onFeedback && !actions.rated && (
            <span className="report-answer__rate">
              <span className="muted small">¿Te sirvió?</span>
              <Button variant="ghost" size="sm" iconOnly aria-label="Me sirvió" disabled={busy !== null} onClick={() => onFeedback(true)}>
                <ThumbsUp size={16} />
              </Button>
              <Button variant="ghost" size="sm" iconOnly aria-label="No me sirvió" disabled={busy !== null} onClick={() => onFeedback(false)}>
                <ThumbsDown size={16} />
              </Button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
