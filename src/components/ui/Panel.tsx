import type { FormEvent, ReactNode } from 'react';
import { PageHeader } from '../PageHeader';

/**
 * Contenedor único de pantalla: el formulario o detalle completo vive en un solo bloque, con
 * encabezado, secciones separadas por divisores y una barra de acciones al pie.
 *
 *   <Panel onSubmit={save}>                       ← un solo div (o form)
 *     <PanelHeader title=… actions=… />
 *     <PanelGrid> <PanelSection/> <PanelSection/> </PanelGrid>
 *     <PanelSection title=…>…</PanelSection>
 *     <PanelFooter>botones</PanelFooter>
 *   </Panel>
 */
interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Si se indica, el contenedor es un <form> (envío con Enter, validación propia). */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

export function Panel({ children, className = '', onSubmit }: PanelProps) {
  const classes = `panel ${className}`.trim();
  return onSubmit ? (
    <form className={classes} onSubmit={onSubmit} noValidate>
      {children}
    </form>
  ) : (
    <div className={classes}>{children}</div>
  );
}

type PanelHeaderProps = Parameters<typeof PageHeader>[0];

/** Encabezado del panel (título, regreso, subtítulo y acciones). */
export function PanelHeader(props: PanelHeaderProps) {
  return (
    <header className="panel__head">
      <PageHeader {...props} />
    </header>
  );
}

/** Encabezado centrado para pantallas de bienvenida (registro, credencial, menú). */
export function PanelHero({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="panel__head panel__head--hero">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {children}
    </header>
  );
}

interface PanelSectionProps {
  title?: ReactNode;
  icon?: ReactNode;
  /** Elementos a la derecha del título (insignias, enlaces). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Sección dentro del panel, separada de las demás por un divisor. */
export function PanelSection({ title, icon, aside, children, className = '' }: PanelSectionProps) {
  return (
    <section className={`panel__section ${className}`.trim()}>
      {(title || aside) && (
        <div className="panel__section-head">
          {title && (
            <h2 className="panel__section-title">
              {icon} {title}
            </h2>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Secciones lado a lado (en pantallas anchas), separadas por líneas finas. */
export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="panel__grid">{children}</div>;
}

/** Barra de acciones al pie del panel. */
export function PanelFooter({ children, align = 'end' }: { children: ReactNode; align?: 'end' | 'between' | 'center' }) {
  return <footer className={`panel__footer panel__footer--${align}`}>{children}</footer>;
}
