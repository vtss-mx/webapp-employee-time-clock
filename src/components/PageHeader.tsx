import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Volver', actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {backTo && (
          <Link to={backTo} className="page-header__back">
            <ArrowLeft size={18} /> {backLabel}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
