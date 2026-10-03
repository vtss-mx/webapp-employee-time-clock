import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  /** Qué significa y qué aparecerá aquí (o cómo empezar). */
  description?: ReactNode;
  /** Acción para crear el primero (solo si aplica). */
  action?: ReactNode;
  /** success: "todo al día" (nada pendiente); neutral: aún no hay datos. */
  tone?: 'neutral' | 'success';
  /** Dentro de un panel o tarjeta (bitácoras, actividad reciente). */
  compact?: boolean;
}

/**
 * Estado vacío ÚNICO de la aplicación: cuando un listado no tiene registros se explica con un ícono,
 * un título y una descripción (y la acción para empezar), y el paginador no se muestra.
 */
export function EmptyState({ icon, title, description, action, tone = 'neutral', compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${tone} ${compact ? 'empty-state--compact' : ''}`} role="status">
      <span className="empty-state__icon" aria-hidden>
        {icon}
      </span>
      <strong className="empty-state__title">{title}</strong>
      {description && <p className="empty-state__text">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
