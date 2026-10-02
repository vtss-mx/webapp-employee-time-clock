import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: ReactNode;
}

/**
 * Lista desplegable con el estilo del sistema (mismo alto, borde, foco e ícono que los demás
 * controles). Usa el <select> nativo por accesibilidad y por el selector nativo en móviles.
 */
export function Select({ icon, className = '', children, ...props }: SelectProps) {
  return (
    <span className={`select ${icon ? 'select--with-icon' : ''} ${className}`.trim()}>
      {icon && <span className="select__icon">{icon}</span>}
      <select className="select__control" {...props}>
        {children}
      </select>
      <ChevronDown size={18} className="select__chevron" aria-hidden />
    </span>
  );
}
