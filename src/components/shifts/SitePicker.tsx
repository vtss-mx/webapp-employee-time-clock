import { MapPinPlus } from 'lucide-react';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { siteService } from '../../services/siteService';
import type { WorkSite } from '../../types';
import { addressLine } from '../../utils/address';
import { ButtonLink } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { EmptyState } from '../ui/EmptyState';
import { RetryState } from '../ui/RetryState';
import { SkeletonRows } from '../ui/Skeleton';
import { metersText } from './shiftRules';

/** Lo más que acepta el backend en una asignación (y la página más grande de la API). */
const MAX_SITES = 50;

interface SitePickerProps {
  label: string;
  /** Sitios elegidos (ids). */
  value: readonly number[];
  /** Los elegidos y sus nombres (para la confirmación). */
  onChange: (ids: number[], names: string[]) => void;
  error?: string;
  /** Por qué se piden (o por qué no hacen falta). */
  hint: string;
  disabled?: boolean;
}

/**
 * Sitios donde el empleado checa en persona: los sitios ACTIVOS de la empresa como casillas propias
 * (`Checkbox`: toda la tarjeta se toca). Los pide al backend (hasta 50, el máximo de una
 * asignación); sin sitios invita a dar de alta el primero.
 */
export function SitePicker({ label, value, onChange, error, hint, disabled = false }: SitePickerProps) {
  const { data, error: loadError, retry } = useResource((signal) => siteService.list({ active: true, page: 1, size: MAX_SITES }, signal), 'active-sites', 'No se pudieron cargar los sitios');
  const toggle = (id: number, sites: WorkSite[]) => {
    const ids = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(ids, sites.filter((site) => ids.includes(site.id)).map((site) => site.name));
  };

  const body = () => {
    if (!data) return loadError ? <RetryState onRetry={retry} /> : <SkeletonRows rows={2} />;
    if (data.items.length === 0) {
      return (
        <EmptyState
          compact
          icon={<MapPinPlus />}
          title="No hay sitios activos"
          description="Da de alta el lugar donde checa tu personal (planta, sucursal, oficina...) con su punto en el mapa y su radio."
          action={
            <ButtonLink to={paths.company.newSite} variant="secondary" icon={<MapPinPlus size={18} />}>
              Nuevo sitio
            </ButtonLink>
          }
        />
      );
    }
    return (
      <ul className="site-picker__list">
        {data.items.map((site) => (
          <li key={site.id}>
            <Checkbox
              className="site-option"
              checked={value.includes(site.id)}
              disabled={disabled}
              onChange={() => toggle(site.id, data.items)}
              label={site.name}
              description={addressLine(site.address)}
              aside={<span className="badge badge--info badge--plain">{metersText(site.radius_m)}</span>}
            />
          </li>
        ))}
      </ul>
    );
  };

  // Más de 50 sitios activos: se avisa que solo se ofrecen los primeros (nunca listas sin límite).
  const more = data && data.total > data.items.length ? ` Se muestran los primeros ${data.items.length} sitios activos (orden alfabético).` : '';
  return (
    <ChoiceGroup label={label} className="site-picker" error={error} hint={hint + more}>
      {body()}
    </ChoiceGroup>
  );
}
