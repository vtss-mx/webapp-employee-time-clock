import { Hourglass } from 'lucide-react';

/** Indicador animado de estado (éxito con trazo dibujado, error, en espera). */
export function StatusMark({ kind, once = false }: { kind: 'success' | 'error' | 'pending'; once?: boolean }) {
  return (
    <div className={`status-mark status-mark--${kind} ${once ? 'status-mark--once' : ''}`} aria-hidden>
      <div className="status-mark__core">
        {kind === 'success' && (
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path className="draw-path" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
        {kind === 'error' && (
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path className="draw-path" d="M7 7l10 10M17 7L7 17" />
          </svg>
        )}
        {kind === 'pending' && <Hourglass size={40} />}
      </div>
    </div>
  );
}
