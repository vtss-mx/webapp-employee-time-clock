import { MessageSquareText, Send, Sparkles } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { useAction } from '../../hooks/useAction';
import { reportService } from '../../services/reportService';
import type { ReportAnswer } from '../../types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { AnswerCard } from './AnswerCard';
import { useReportActions } from './useReportActions';

interface Turn {
  id: number;
  question: string;
  answer: ReportAnswer;
  /** Lo que aprendió al aclarar la pregunta anterior («ponche» → Identificaciones). */
  learned: string[];
  rated: boolean;
}

/**
 * Conversación con el asistente de reportes. Cada pregunta viaja con el plan de la última respuesta
 * con datos: así «¿y por departamento?» o «expórtalo» siguen la conversación. Si no entiende de qué
 * datos se trata, la persona lo aclara con un clic y el asistente lo aprende (solo para su empresa).
 */
export function ReportAssistant({ suggestions, onSaved }: { suggestions: string[]; onSaved: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const nextId = useRef(1);
  const asking = useAction<string>();
  const report = useReportActions(onSaved);
  const context = [...turns].reverse().find((turn) => turn.answer.plan)?.answer.plan ?? null;

  const append = (asked: string, answer: ReportAnswer, learned: string[] = []) => {
    const turn = { id: nextId.current++, question: asked, answer, learned, rated: false };
    setTurns((current) => [...current, turn]);
    // «En Excel», «expórtalo»: la respuesta ya trae el archivo.
    if (answer.export && answer.plan) void report.exportPlan(answer.plan, answer.query_id, asked);
  };

  const ask = (text: string) => {
    const asked = text.trim();
    if (!asked) return;
    void asking.run(() => reportService.ask(asked, context), {
      busy: 'ask',
      errorTitle: 'El asistente no pudo responder',
      onSuccess: (answer) => {
        setQuestion('');
        append(asked, answer);
      },
    });
  };

  const clarify = (turn: Turn, dataset: string) =>
    void asking.run(() => reportService.feedback(turn.answer.query_id as number, { dataset }), {
      busy: 'feedback',
      errorTitle: 'No se pudo aclarar la pregunta',
      onSuccess: (result) => result.answer && append(turn.question, result.answer, result.learned),
    });

  const rate = (turn: Turn, helpful: boolean) =>
    void asking.run(() => reportService.feedback(turn.answer.query_id as number, { helpful }), {
      busy: 'feedback',
      errorTitle: 'No se pudo registrar tu opinión',
      success: helpful ? ['Gracias', 'Seguiré respondiendo así.'] : ['Gracias', 'Lo tomaré en cuenta para entenderte mejor.'],
      onSuccess: () => setTurns((current) => current.map((t) => (t.id === turn.id ? { ...t, rated: true } : t))),
    });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(question);
  };

  const busy = asking.busy ?? report.busy;
  return (
    <div className="report-assistant">
      {turns.length === 0 ? (
        <EmptyState
          compact
          icon={<MessageSquareText />}
          title="Pregúntame sobre tus datos"
          description="Por ejemplo: «¿cuántas identificaciones fallidas hubo ayer por motivo?» o «horas trabajadas por empleado esta semana». Puedo exportar cualquier respuesta a Excel."
        />
      ) : (
        <ol className="report-thread" aria-live="polite">
          {turns.map((turn) => (
            <li key={turn.id} className="report-turn">
              <p className="report-turn__question">{turn.question}</p>
              <AnswerCard
                answer={turn.answer}
                learned={turn.learned}
                actions={{
                  busy,
                  rated: turn.rated,
                  onExport: () => void report.exportPlan(turn.answer.plan as NonNullable<ReportAnswer['plan']>, turn.answer.query_id, turn.question),
                  onSave: () => void report.save(turn.question, turn.answer.plan as NonNullable<ReportAnswer['plan']>, turn.question, turn.answer.query_id),
                  onFeedback: (helpful) => rate(turn, helpful),
                  onAlternative: (dataset) => clarify(turn, dataset),
                }}
              />
            </li>
          ))}
        </ol>
      )}
      <form className="report-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="report-question">
          Tu pregunta
        </label>
        <input
          id="report-question"
          className="input"
          value={question}
          maxLength={500}
          autoComplete="off"
          placeholder="Escribe tu pregunta: ¿quién llegó después de las 9 hoy?"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" variant="primary" icon={<Send size={18} />} loading={asking.busy === 'ask'} disabled={busy !== null || !question.trim()}>
          Preguntar
        </Button>
      </form>
      {suggestions.length > 0 && (
        <div className="report-suggestions">
          <span className="muted small">
            <Sparkles size={14} /> Sugerencias {turns.length === 0 ? 'para empezar' : '(lo que más preguntas)'}
          </span>
          <div className="chips">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" disabled={busy !== null} onClick={() => ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
