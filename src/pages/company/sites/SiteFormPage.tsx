import { MapPin, MapPinHouse, MapPinPlus, Radar, Ruler, Save } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { AddressFields } from '../../../components/location/AddressFields';
import { LocationPicker } from '../../../components/location/LocationPicker';
import { QuickChoices } from '../../../components/shifts/formFields';
import { RecordLoader } from '../../../components/shifts/PageStates';
import { RecordStatus, type RecordStatusTexts } from '../../../components/shifts/RecordStatus';
import { metersText, SITE_NAME_MAX } from '../../../components/shifts/shiftRules';
import { useSiteForm, type SiteForm } from '../../../components/shifts/useSiteForm';
import { NumberField } from '../../../components/ui/NumberField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useFeedback } from '../../../hooks/useFeedback';
import { RADIUS_MAX_M, RADIUS_MIN_M } from '../../../hooks/useValidatorForm';
import { paths } from '../../../routes/paths';
import { siteService } from '../../../services/siteService';
import type { WorkSite } from '../../../types';
import { pickAddress } from '../../../utils/address';

/** Radios sugeridos (m): de una oficina a una planta o un predio grande. */
const RADIUS_CHOICES = [50, 100, 200, 300, 500, 1000].map((meters) => ({ value: String(meters), text: metersText(meters) }));

const STATUS_TEXTS: RecordStatusTexts = {
  title: 'Estado del sitio',
  subject: 'El sitio',
  activeMeaning: 'Tu personal puede checar aquí y se puede elegir en las asignaciones de turno.',
  inactiveMeaning: 'Nadie puede checar en este sitio y no se puede elegir en las asignaciones.',
  deactivateWarning: 'Nadie podrá checar en este sitio ni elegirlo en una asignación hasta que lo actives. Lo ya registrado se conserva.',
  removeWarning: 'Solo se puede eliminar un sitio que no está en ninguna asignación de turno. Si ya se usó, desactívalo para conservar su historial.',
  inUseCode: 'SITE_IN_USE',
};

/**
 * Alta (/company/sites/new) o edición (/company/sites/:id/edit) de un sitio de trabajo: su nombre,
 * su domicilio con el punto en el mapa y el radio desde ese punto en que se puede checar "en sitio".
 */
export function SiteFormPage() {
  const { id } = useParams();
  return (
    <RecordLoader
      id={id ? Number(id) : null}
      load={(siteId, signal) => siteService.get(siteId, signal)}
      errorTitle="No se pudo cargar el sitio"
      failed={{ title: 'Editar sitio', backTo: paths.company.sites, backLabel: 'Sitios de trabajo' }}
    >
      {(site) => <SiteFormView key={site?.id ?? 'new'} original={site} />}
    </RecordLoader>
  );
}

function SiteFormView({ original }: { original: WorkSite | null }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useSiteForm(original);
  const [active, setActive] = useState(original?.active ?? true);
  const back = () => void navigate(paths.company.sites);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void form.save((saved) => {
      const rule = `Se puede checar en sitio a no más de ${metersText(saved.radius_m)} del punto marcado.`;
      void feedback.success(original ? 'Sitio actualizado' : 'Sitio creado', original ? `${saved.name} quedó actualizado. ${rule}` : `${saved.name} ya se puede elegir al asignar turnos. ${rule}`);
      back();
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={original ? 'Editar sitio' : 'Nuevo sitio'}
          subtitle={original?.name ?? 'Un lugar donde tu personal checa en persona: planta, sucursal, oficina...'}
          backTo={paths.company.sites}
          backLabel="Sitios de trabajo"
        />
        <SiteSection form={form} />
        <LocationSection form={form} />
        {original && (
          <RecordStatus
            name={original.name}
            active={active}
            texts={STATUS_TEXTS}
            setStatus={(next) => siteService.setStatus(original.id, next)}
            remove={() => siteService.remove(original.id)}
            onStatus={setActive}
            onRemoved={() => void navigate(paths.company.sites, { replace: true })}
          />
        )}
        <FormFooter submitLabel={original ? 'Guardar cambios' : 'Crear sitio'} submitIcon={original ? <Save size={20} /> : <MapPinPlus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}

/** Nombre del sitio y radio de la geocerca (con radios sugeridos). */
function SiteSection({ form }: { form: SiteForm }) {
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title="Sitio" icon={<MapPin size={20} />}>
      <div className="form-grid">
        <FormField
          label="Nombre del sitio"
          icon={<MapPin size={18} />}
          required
          maxLength={SITE_NAME_MAX}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint="Único en tu empresa: p. ej. “Planta Hermosillo”"
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="field-stack">
          <NumberField
            label="Radio para checar (metros)"
            icon={<Ruler size={18} />}
            unit="m"
            step={10}
            required
            min={RADIUS_MIN_M}
            max={RADIUS_MAX_M}
            disabled={saving}
            value={values.radius}
            error={errors.radius}
            hint={`Entre ${RADIUS_MIN_M} y ${RADIUS_MAX_M.toLocaleString('es-MX')} m: el tamaño del lugar más el margen del GPS.`}
            onBlur={() => touch('radius')}
            onChange={(value) => set('radius', value)}
          />
          <QuickChoices label="Radios sugeridos" value={values.radius} choices={RADIUS_CHOICES} disabled={saving} onPick={(value) => set('radius', value)} />
        </div>
      </div>
      <p className="small muted inline-note">
        <Radar size={16} aria-hidden /> Checar “en sitio” es hacerlo con el rostro y la ubicación del teléfono a no más de este radio del punto del mapa.
      </p>
    </PanelSection>
  );
}

/** Domicilio y punto del sitio: el círculo del mapa muestra el radio en vivo. */
function LocationSection({ form }: { form: SiteForm }) {
  const { values, errors, set, touch, saving, point, radius, pointError, setPoint, applyAddress } = form;
  const address = pickAddress(values);
  return (
    <PanelSection title="Ubicación" icon={<MapPinHouse size={20} />}>
      <p className="muted small">Busca el lugar o toca el mapa: el círculo muestra hasta dónde se puede checar en sitio.</p>
      <LocationPicker address={address} point={point} radius={radius} error={pointError} onPoint={setPoint} onAddress={applyAddress} disabled={saving} pointOf="del sitio" />
      <AddressFields values={address} errors={errors} disabled={saving} onChange={set} onTouch={touch} />
    </PanelSection>
  );
}
