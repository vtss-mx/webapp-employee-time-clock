import { Map as MapIcon, MapPinHouse, Save, ScanLine, ShieldCheck } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddressFields } from '../../components/location/AddressFields';
import { LocationPicker } from '../../components/location/LocationPicker';
import { metersText } from '../../components/shifts/shiftRules';
import { ValidatorAccountFields, ValidatorLocationRule } from '../../components/ValidatorForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { settingsOf, useValidatorForm, validateRadius } from '../../hooks/useValidatorForm';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Address, Validator, ValidatorMode, ValidatorSettings } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { addressLine, formatPoint, pickAddress, type AddressValues } from '../../utils/address';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';

/**
 * Alta (/company/validators/new) o edición (/company/validators/:id/edit) de un validador de
 * identidad: cuenta y modo, domicilio del acceso con su punto en el mapa y "requiere ubicación".
 */
export function ValidatorFormPage() {
  const { id } = useParams();
  const validatorId = id ? Number(id) : null;
  // Alta: no hay nada que cargar (el validador se crea en esta pantalla).
  const { data: original, error, retry: load } = useResource(
    (signal) => (validatorId === null ? Promise.resolve(null) : validatorService.get(validatorId, signal)),
    validatorId ?? 'new',
    'No se pudo cargar el validador',
  );

  if (validatorId === null) return <ValidatorForm original={null} />;
  if (!original) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Editar validador" backTo={paths.company.validators} backLabel="Validadores" />
          <PanelSection>
            <RetryState onRetry={load} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={8} />
    );
  }
  return <ValidatorForm key={original.id} original={original} />;
}

/** Lo que define dónde puede iniciar sesión: si cambia (y se exige), su sesión abierta se cierra. */
type LocationRuleSource = Pick<ValidatorSettings, 'location_required' | 'location_radius_m'> & { address: Pick<Address, 'latitude' | 'longitude'> | null };
const locationRule = (v: LocationRuleSource) => [v.location_required, v.address?.latitude, v.address?.longitude, v.location_radius_m].join('|');

/** El validador como lo lee la persona en la confirmación (valores ya legibles). */
interface ValidatorSummary {
  name: string;
  email: string;
  mode: string;
  /** Todos los campos del domicilio (cualquier cambio cuenta); se muestra en una línea. */
  address: AddressValues;
  point: string;
  rule: string;
}

/** Domicilio en una línea; el municipio, si no es la ciudad, entre paréntesis. */
function placeText(address: AddressValues): string {
  const line = addressLine(address);
  return address.municipality && address.municipality !== address.city ? `${line} (municipio ${address.municipality})` : line;
}

/** Filas de la confirmación, en este orden (sin la contraseña: nunca se muestra). */
const SUMMARY_LABELS: FieldLabels<ValidatorSummary> = {
  name: 'Nombre',
  email: 'Correo de acceso',
  mode: 'Modo de identificación',
  address: { label: 'Domicilio', format: placeText },
  point: 'Punto en el mapa',
  rule: 'Exige ubicación',
};

function summaryOf(settings: ValidatorSettings, modeName: (mode: ValidatorMode) => string, email = ''): ValidatorSummary {
  const { latitude, longitude } = settings.address;
  return {
    name: settings.name,
    email,
    mode: modeName(settings.mode),
    address: pickAddress(settings.address),
    point: latitude !== null && longitude !== null ? formatPoint({ lat: latitude, lng: longitude }) : 'Sin marcar',
    rule: settings.location_required && settings.location_radius_m ? `Sí, a ${metersText(settings.location_radius_m)}` : 'No',
  };
}

/** Alta: qué se registrará (cuenta, modo, domicilio, punto y regla de ubicación). */
function createConfirm(settings: ValidatorSettings, email: string, modeName: (mode: ValidatorMode) => string): ConfirmInput {
  return {
    kind: 'create',
    icon: <ScanLine size={30} />,
    title: `¿Agregar el validador ${settings.name}?`,
    message: 'Podrá iniciar sesión con este correo y la contraseña que asignaste desde una tableta o un teléfono; cada dispositivo nuevo queda por autorizar.',
    detailsTitle: 'Se registrará',
    details: describeValues(summaryOf(settings, modeName, email), SUMMARY_LABELS),
    confirmLabel: 'Agregar validador',
    confirmIcon: <ScanLine size={18} />,
  };
}

/** Edición: qué cambia ("antes → después"; sin cambios no se envía nada) y si su sesión se cerrará. */
function editConfirm(original: Validator, settings: ValidatorSettings, modeName: (mode: ValidatorMode) => string): ConfirmInput {
  return {
    kind: 'edit',
    title: `¿Guardar los cambios de ${original.name}?`,
    changes: describeChanges(summaryOf(settingsOf(original), modeName), summaryOf(settings, modeName), SUMMARY_LABELS),
    note: settings.location_required && locationRule(settings) !== locationRule(original) ? 'Su sesión abierta se cerrará: deberá iniciar sesión de nuevo desde ese lugar.' : undefined,
  };
}

/** El aviso al guardar: qué cambia para quien usa el validador. */
function savedMessage(saved: Validator, original: Validator | null) {
  const details = [
    saved.location_required && saved.location_radius_m
      ? `Solo podrá iniciar sesión a no más de ${saved.location_radius_m.toLocaleString('es-MX')} m del punto marcado.`
      : 'Puede iniciar sesión desde cualquier lugar.',
  ];
  if (original && saved.location_required && locationRule(saved) !== locationRule(original)) {
    details.push('Su sesión abierta se cerró: deberá iniciar sesión de nuevo desde ese lugar.');
  }
  return original
    ? { title: 'Validador actualizado', text: `${saved.name} quedó actualizado.`, details }
    : { title: 'Validador agregado', text: `${saved.email} ya puede iniciar sesión desde una tableta o un teléfono.`, details };
}

function ValidatorForm({ original }: { original: Validator | null }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useValidatorForm(original);
  const { nameOf } = useCatalogs();
  const back = () => void navigate(paths.company.validators);
  const addressValues = pickAddress(form.values);
  const radius = form.locationRequired && !validateRadius(form.values.radius) ? Number(form.values.radius) : null;
  const modeName = (mode: ValidatorMode) => nameOf('validator_modes', mode);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void form.save(
      (saved) => {
        const message = savedMessage(saved, original);
        void feedback.success(message.title, message.text, { details: message.details, detailsStyle: 'checks' });
        back();
      },
      (settings) => (original ? editConfirm(original, settings, modeName) : createConfirm(settings, form.values.email.trim(), modeName)),
    );
  };

  const Icon = form.creating ? ScanLine : Save;
  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={form.creating ? 'Agregar validador' : 'Editar validador'}
          subtitle={original?.email ?? 'Cuenta para la tableta o el teléfono de un acceso: recepción, comedor, planta...'}
          backTo={paths.company.validators}
          backLabel="Validadores"
        />
        <PanelSection title="Cuenta y modo de identificación" icon={<ShieldCheck size={20} />}>
          <ValidatorAccountFields form={form} />
        </PanelSection>
        <PanelSection title="Domicilio del acceso" icon={<MapPinHouse size={20} />}>
          <p className="muted small">Busca el lugar o toca el mapa: el domicilio se llena con lo que Google conoce del punto y puedes corregirlo.</p>
          <LocationPicker
            point={form.point}
            radius={radius}
            address={addressValues}
            error={form.pointError}
            disabled={form.saving}
            onPoint={form.setPoint}
            onAddress={form.applyAddress}
          />
          <AddressFields values={addressValues} errors={form.errors} onChange={form.set} onTouch={form.touch} disabled={form.saving} />
        </PanelSection>
        <PanelSection title="Ubicación para iniciar sesión" icon={<MapIcon size={20} />}>
          <ValidatorLocationRule form={form} />
        </PanelSection>
        <PanelFooter>
          <Button variant="ghost" size="lg" onClick={back} disabled={form.saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" icon={<Icon size={20} />} loading={form.saving} disabled={form.checking}>
            {form.creating ? 'Agregar validador' : 'Guardar cambios'}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
