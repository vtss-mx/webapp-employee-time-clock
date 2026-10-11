import { CalendarRange, ListFilter, ScrollText } from 'lucide-react';
import { Button } from '../ui/Button';
import { DateField } from '../ui/DateField';
import { ListToolbar } from '../ui/ListControls';
import { Select } from '../ui/Select';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import { catalogOptions } from '../../utils/catalogs';

/** Lo que la persona eligió en la barra de filtros (los días son de calendario; la pantalla los vuelve instantes). */
export interface AuditChoice {
  since: string;
  until: string;
  action: string;
  outcome: string;
}

export const EMPTY_CHOICE: AuditChoice = { since: '', until: '', action: '', outcome: '' };

interface AuditToolbarProps {
  choice: AuditChoice;
  onChange: (choice: AuditChoice) => void;
  /** La búsqueda la lleva el listado (espera entre teclas): el correo, el id de la entidad o el traceId. */
  search: string;
  onSearch: (value: string) => void;
  /** Hay algo elegido: se ofrece quitar los filtros. */
  filtered: boolean;
  /** Último día que se puede elegir (hoy en la zona del negocio). */
  today: string;
}

/**
 * Filtros de la bitácora: el periodo (dos `DateField`, nunca un calendario nativo), la acción y el resultado con
 * los nombres de sus catálogos (`audit_actions` y `audit_outcomes`) y la búsqueda por correo, id o traceId.
 *
 * Las listas incluyen «todas» y «todos» como primera opción: un valor vacío no se envía. Los nombres de las
 * acciones y de los resultados NO se escriben aquí (regla 1 de la raíz).
 */
export function AuditToolbar({ choice, onChange, search, onSearch, filtered, today }: AuditToolbarProps) {
  const t = useT();
  const { active } = useCatalogs();
  const set = <K extends keyof AuditChoice>(key: K, value: AuditChoice[K]) => onChange({ ...choice, [key]: value });
  // Quitar los filtros limpia también la búsqueda: lo que se ve vuelve a ser el periodo por omisión del servidor.
  const clear = () => {
    onChange(EMPTY_CHOICE);
    onSearch('');
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <DateField label={t('audit.filters.since')} value={choice.since} max={choice.until || today} onChange={(value) => set('since', value)} openTo={today} />
        <DateField label={t('audit.filters.until')} value={choice.until} min={choice.since} max={today} onChange={(value) => set('until', value)} openTo={today} />
      </div>
      <div className="toolbar">
        <Select<string>
          value={choice.action}
          onChange={(value) => set('action', value)}
          aria-label={t('audit.filters.action')}
          icon={<ScrollText size={16} />}
          searchable
          options={[{ value: '', label: t('audit.filters.allActions') }, ...catalogOptions(active('audit_actions'))]}
        />
        <Select<string>
          value={choice.outcome}
          onChange={(value) => set('outcome', value)}
          aria-label={t('audit.filters.outcome')}
          icon={<ListFilter size={16} />}
          options={[{ value: '', label: t('audit.filters.allOutcomes') }, ...catalogOptions(active('audit_outcomes'))]}
        />
        {filtered && (
          <Button variant="ghost" size="sm" icon={<CalendarRange size={16} />} onClick={() => clear()}>
            {t('audit.filters.clear')}
          </Button>
        )}
      </div>
      <ListToolbar search={search} onSearch={onSearch} placeholder={t('audit.filters.searchPlaceholder')} label={t('audit.filters.search')} />
    </div>
  );
}
