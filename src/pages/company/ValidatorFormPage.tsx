import { Map as MapIcon, MapPinHouse, Save, ScanLine, ShieldCheck } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddressFields } from '../../components/location/AddressFields';
import { LocationPicker } from '../../components/location/LocationPicker';
import type { MessageInput } from '../../components/MessageDialog';
import { metersText } from '../../utils/numbers';
import { ValidatorAccountFields, ValidatorLocationRule } from '../../components/ValidatorForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { radiusText, settingsOf, useValidatorForm, validateRadius } from '../../hooks/useValidatorForm';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Address, Validator, ValidatorMode, ValidatorSettings } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { addressLine, formatPoint, pickAddress, type AddressValues } from '../../utils/address';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';
import { DeletedValidator } from './ValidatorTrash';

/**
 * Alta (/company/validators/new) o edición (/company/validators/:id/edit) de un validador de
 * identidad: cuenta y modo, domicilio del acceso con su punto en el mapa y "requiere ubicación".
 * Uno en «Eliminados» no se edita: solo su aviso con «Restaurar».
 */
export function ValidatorFormPage() {
  const t = useT();
  const { id } = useParams();
  const validatorId = id ? Number(id) : null;
  // Alta: no hay nada que cargar (el validador se crea en esta pantalla).
  const { data: original, setData, error, retry: load } = useResource(
    (signal) => (validatorId === null ? Promise.resolve(null) : validatorService.get(validatorId, signal)),
    validatorId ?? 'new',
    loadError,
  );

  if (validatorId === null) return <ValidatorForm original={null} />;
  if (!original) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={t('validators.form.editTitle')} backTo={paths.company.validators} backLabel={t('validators.back')} />
          <PanelSection>
            <RetryState onRetry={load} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={8} />
    );
  }
  if (original.deleted_at) return <DeletedValidator validator={original} onRestored={setData} />;
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
  /** Todos los campos del domicilio salvo las referencias (cualquier cambio cuenta); se muestra en una línea. */
  address: AddressValues;
  /** Las referencias, en su propia fila (no forman parte de la línea del domicilio). */
  references: string;
  point: string;
  rule: string;
}

/** Domicilio en una línea; el municipio, si no es la ciudad, entre paréntesis. */
function placeText(address: AddressValues): string {
  const line = addressLine(address);
  return address.municipality && address.municipality !== address.city ? t('validators.form.summary.municipality', { address: line, municipality: address.municipality }) : line;
}

/** Filas de la confirmación, en este orden (sin la contraseña: nunca se muestra) y en el idioma activo. */
const summaryLabels = (): FieldLabels<ValidatorSummary> => ({
  name: t('common.fields.name'),
  email: t('validators.accessEmail'),
  mode: t('validators.form.summary.mode'),
  address: { label: t('validators.form.summary.address'), format: placeText },
  references: t('validators.form.summary.references'),
  point: t('validators.form.summary.point'),
  rule: t('validators.form.summary.rule'),
});

function summaryOf(settings: ValidatorSettings, modeName: (mode: ValidatorMode) => string, email = ''): ValidatorSummary {
  const { latitude, longitude } = settings.address;
  return {
    name: settings.name,
    email,
    mode: modeName(settings.mode),
    address: { ...pickAddress(settings.address), reference_notes: '' },
    references: settings.address.reference_notes ?? '',
    point: latitude !== null && longitude !== null ? formatPoint({ lat: latitude, lng: longitude }) : t('validators.form.summary.unmarked'),
    rule: settings.location_required && settings.location_radius_m ? t('validators.form.summary.ruleRadius', { radius: metersText(settings.location_radius_m) }) : t('common.values.no'),
  };
}

/** Alta: qué se registrará (cuenta, modo, domicilio, punto y regla de ubicación). */
function createConfirm(settings: ValidatorSettings, email: string, modeName: (mode: ValidatorMode) => string): ConfirmInput {
  return {
    kind: 'create',
    icon: <ScanLine size={30} />,
    title: t('validators.form.createConfirm.title', { name: settings.name }),
    message: t('validators.form.createConfirm.message'),
    detailsTitle: t('validators.form.createConfirm.detailsTitle'),
    details: describeValues(summaryOf(settings, modeName, email), summaryLabels()),
    confirmLabel: t('validators.form.addTitle'),
    confirmIcon: <ScanLine size={18} />,
  };
}

/** Edición: qué cambia ("antes → después"; sin cambios no se envía nada) y si su sesión se cerrará. */
function editConfirm(original: Validator, settings: ValidatorSettings, modeName: (mode: ValidatorMode) => string): ConfirmInput {
  return {
    kind: 'edit',
    title: t('validators.form.editConfirm.title', { name: original.name }),
    changes: describeChanges(summaryOf(settingsOf(original), modeName), summaryOf(settings, modeName), summaryLabels()),
    note: settings.location_required && locationRule(settings) !== locationRule(original) ? t('validators.form.editConfirm.note') : undefined,
  };
}

/** El aviso al guardar: qué cambia para quien usa el validador (se arma al dibujarse: sigue al idioma activo). */
function savedMessage(saved: Validator, original: Validator | null): MessageInput {
  const details = [
    saved.location_required && saved.location_radius_m ? t('validators.form.saved.radius', { radius: radiusText(saved.location_radius_m) }) : t('validators.form.anywhere'),
  ];
  if (original && saved.location_required && locationRule(saved) !== locationRule(original)) {
    details.push(t('validators.form.saved.sessionClosed'));
  }
  const text = original ? undefined : t('validators.form.saved.addedText', { email: saved.email });
  return { variant: 'success', title: t(original ? 'validators.form.saved.updated' : 'validators.form.saved.added'), text, details, detailsStyle: 'checks' };
}

const loadError = () => t('validators.loadError');

function ValidatorForm({ original }: { original: Validator | null }) {
  const t = useT();
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
        void feedback.show(() => savedMessage(saved, original));
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
          title={t(form.creating ? 'validators.form.addTitle' : 'validators.form.editTitle')}
          subtitle={original?.email ?? t('validators.form.subtitle')}
          backTo={paths.company.validators}
          backLabel={t('validators.back')}
        />
        <PanelSection title={t('validators.form.accountSection')} icon={<ShieldCheck size={20} />}>
          <ValidatorAccountFields form={form} />
        </PanelSection>
        <PanelSection title={t('validators.form.addressSection')} icon={<MapPinHouse size={20} />}>
          <p className="muted small">{t('validators.form.addressIntro')}</p>
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
        <PanelSection title={t('validators.form.locationSection')} icon={<MapIcon size={20} />}>
          <ValidatorLocationRule form={form} />
        </PanelSection>
        <PanelFooter>
          <Button variant="ghost" size="lg" onClick={back} disabled={form.saving}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" size="lg" icon={<Icon size={20} />} loading={form.saving} disabled={form.checking}>
            {t(form.creating ? 'validators.form.addTitle' : 'common.actions.saveChanges')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
