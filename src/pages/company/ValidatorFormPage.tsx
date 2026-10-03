import { Map as MapIcon, MapPinHouse, Save, ScanLine, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddressFields } from '../../components/location/AddressFields';
import { LocationPicker } from '../../components/location/LocationPicker';
import { ValidatorAccountFields, ValidatorLocationRule } from '../../components/ValidatorForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useValidatorForm, validateRadius } from '../../hooks/useValidatorForm';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import { pickAddress } from '../../utils/address';

/**
 * Alta (/company/validators/new) o edición (/company/validators/:id/edit) de un validador de
 * identidad: cuenta y modo, domicilio del acceso con su punto en el mapa y "requiere ubicación".
 */
export function ValidatorFormPage() {
  const { id } = useParams();
  const validatorId = id ? Number(id) : null;
  // Alta: no hay nada que cargar (el validador se crea en esta pantalla).
  const { data: original, error, retry: load } = useResource(
    () => (validatorId === null ? Promise.resolve(null) : validatorService.get(validatorId)),
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

/** El aviso al guardar: qué cambia para quien usa el validador. */
function savedMessage(saved: Validator, original: Validator | null) {
  const details = [
    saved.location_required && saved.location_radius_m
      ? `Solo podrá iniciar sesión a no más de ${saved.location_radius_m.toLocaleString('es-MX')} m del punto marcado.`
      : 'Puede iniciar sesión desde cualquier lugar.',
  ];
  const rule = (v: Validator | null) => [v?.location_required, v?.address?.latitude, v?.address?.longitude, v?.location_radius_m].join('|');
  if (original && saved.location_required && rule(saved) !== rule(original)) {
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
  const back = () => void navigate(paths.company.validators);
  const addressValues = pickAddress(form.values);
  const radius = form.locationRequired && !validateRadius(form.values.radius) ? Number(form.values.radius) : null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void form.save((saved) => {
      const message = savedMessage(saved, original);
      void feedback.success(message.title, message.text, { details: message.details, detailsStyle: 'checks' });
      back();
    });
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
