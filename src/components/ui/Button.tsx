import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'danger'
  | 'danger-outline'
  | 'warning'
  | 'light'
  | 'link';

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  iconOnly?: boolean;
}

function classes({ variant = 'ghost', size = 'md', block, iconOnly }: CommonProps, extra?: string, loading?: boolean) {
  return [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    iconOnly && 'btn--icon',
    loading && 'is-loading',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Efecto "ripple" (onda) en el punto de contacto. */
function ripple(event: MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const span = document.createElement('span');
  span.className = 'ripple';
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${event.clientX - rect.left - size / 2}px`;
  span.style.top = `${event.clientY - rect.top - size / 2}px`;
  target.appendChild(span);
  window.setTimeout(() => span.remove(), 650);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon, iconRight, iconOnly, loading = false, className, children, onClick, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block, iconOnly }, className, loading)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        ripple(e);
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
      {loading && (
        <span className="btn__spinner" aria-hidden>
          <span className="spinner spinner--current" style={{ width: 20, height: 20 }} />
        </span>
      )}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps, CommonProps {}

export function ButtonLink({ variant, size, block, icon, iconRight, iconOnly, className, children, onClick, ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={classes({ variant, size, block, iconOnly }, className)}
      onClick={(e) => {
        ripple(e);
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
