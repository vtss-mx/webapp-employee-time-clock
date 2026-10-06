import { MapPinPlus } from 'lucide-react';
import { useResource } from '../../hooks/useResource';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { siteService } from '../../services/siteService';
import type { SiteRef, WorkSite } from '../../types';
import { addressLine } from '../../utils/address';
import { StatusBadge } from '../StatusBadge';
import { ButtonLink } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { EmptyState } from '../ui/EmptyState';
import { RetryState } from '../ui/RetryState';
import { SkeletonRows } from '../ui/Skeleton';
import { metersText, sitesLoadError } from './shiftRules';
import type { PickedSite } from './useShiftPlace';

/** Lo más que acepta el backend en un turno (y la página más grande de la API). */
const MAX_SITES = 50;

/** Un sitio que se ofrece: los activos de la empresa y los que el turno ya tiene (aunque estén desactivados). */
type SiteOption = Pick<WorkSite, 'id' | 'name' | 'address' | 'radius_m' | 'active'>;

interface SitePickerProps {
  label: string;
  /** Sitios elegidos (ids). */
  value: readonly number[];
  /** Los sitios que el registro ya tiene: uno desactivado se ofrece igual para poder quitarlo. */
  current?: readonly SiteRef[];
  /** Los elegidos y sus nombres (para la confirmación). */
  onChange: (ids: number[], picked: PickedSite[]) => void;
  error?: string;
  /** Por qué se piden (o por qué no hacen falta). */
  hint: string;
  disabled?: boolean;
}

/**
 * Sitios donde se checa en persona con un turno: los sitios ACTIVOS de la empresa como casillas
 * propias (`Checkbox`: toda la tarjeta se toca), más los que el turno ya tenía y luego se
 * desactivaron (marcados: no aceptan registros; se pueden quitar). Los pide al backend (hasta 50, el
 * máximo de un turno); sin sitios invita a crear el primero.
 */
export function SitePicker({ label, value, current = [], onChange, error, hint, disabled = false }: SitePickerProps) {
  const t = useT();
  const { data, error: loadError, retry } = useResource((signal) => siteService.list({ active: true, page: 1, size: MAX_SITES }, signal), 'active-sites', sitesLoadError);
  const toggle = (id: number, options: readonly SiteOption[]) => {
    const ids = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(
      ids,
      options.filter((site) => ids.includes(site.id)).map(({ id: siteId, name }) => ({ id: siteId, name })),
    );
  };

  const body = () => {
    if (!data) return loadError ? <RetryState onRetry={retry} /> : <SkeletonRows rows={2} />;
    const options: SiteOption[] = [...data.items, ...current.filter((site) => !site.active && !data.items.some((item) => item.id === site.id))];
    if (options.length === 0) {
      return (
        <EmptyState
          compact
          icon={<MapPinPlus />}
          title={t('shifts.sitePicker.empty.title')}
          description={t('shifts.sitePicker.empty.description')}
          action={
            <ButtonLink to={paths.company.newSite} variant="secondary" icon={<MapPinPlus size={18} />}>
              {t('shifts.sitePicker.empty.action')}
            </ButtonLink>
          }
        />
      );
    }
    return (
      <ul className="site-picker__list">
        {options.map((site) => (
          <li key={site.id}>
            <Checkbox
              className="site-option"
              checked={value.includes(site.id)}
              disabled={disabled}
              onChange={() => toggle(site.id, options)}
              label={site.name}
              description={site.active ? addressLine(site.address) : t('shifts.sitePicker.inactive')}
              aside={
                <>
                  {!site.active && <StatusBadge active={false} />} <span className="badge badge--info badge--plain">{metersText(site.radius_m)}</span>
                </>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  // Más de 50 sitios activos: se avisa que solo se ofrecen los primeros (nunca listas sin límite).
  const more = data && data.total > data.items.length ? `${hint} ${t('shifts.sitePicker.firstOnly', { count: data.items.length })}` : hint;
  return (
    <ChoiceGroup label={label} className="site-picker" error={error} hint={more}>
      {body()}
    </ChoiceGroup>
  );
}
