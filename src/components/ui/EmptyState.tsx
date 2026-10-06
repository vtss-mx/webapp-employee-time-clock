import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Ícono de lucide acorde a lo que falta (el mismo de la pantalla o de su entidad). */
  icon: ReactNode;
  /** Título corto, de 2 a 5 palabras: «Sin empresas», «Todo al día». */
  title: string;
  /**
   * Una línea corta (hasta unas 10 palabras): qué aparecerá aquí o cómo empezar. Obligatoria por tipo (decisión
   * del dueño del producto, 2026-10-06): todo vacío lleva ícono, título y descripción, así ninguna pantalla se ve
   * incompleta ni desalineada frente a otra.
   */
  description: string;
  /** Acción para crear el primero (solo si aplica). */
  action?: ReactNode;
  /** success: "todo al día" (nada pendiente); neutral: aún no hay datos. */
  tone?: 'neutral' | 'success';
  /** Dentro de una sección, una pestaña o un panel lateral (no la lista principal de la pantalla). */
  compact?: boolean;
}

/**
 * Estado vacío ÚNICO de la aplicación: cuando un listado no tiene registros se explica con un ícono, un título y
 * una descripción (y la acción para empezar), siempre en ese orden y con el mismo ritmo vertical, y el paginador
 * no se muestra. Su caja (alto mínimo, márgenes y halo) vive en `global.css` (`.empty-state`), no en cada pantalla.
 */
export function EmptyState({ icon, title, description, action, tone = 'neutral', compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${tone} ${compact ? 'empty-state--compact' : ''}`} role="status">
      <span className="empty-state__icon" aria-hidden>
        {icon}
      </span>
      <strong className="empty-state__title">{title}</strong>
      <p className="empty-state__text">{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
