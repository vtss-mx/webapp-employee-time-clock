import { MapPin, MapPinHouse, MapPinPlus, QrCode, Radar, Ruler, Save } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { AddressFields } from '../../../components/location/AddressFields';
import { LocationPicker } from '../../../components/location/LocationPicker';
import { QuickChoices } from '../../../components/ui/formFields';
import { RecordLoader } from '../../../components/ui/PageStates';
import { RecordStatus, type RecordStatusTexts } from '../../../components/sites/RecordStatus';
import { DeletedSite } from '../../../components/sites/SiteTrash';
import { SITE_NAME_MAX } from '../../../components/sites/siteRules';
import { useSiteForm, type SiteForm } from '../../../components/sites/useSiteForm';
import { NumberField } from '../../../components/ui/NumberField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Switch } from '../../../components/ui/Switch';
import { useFeedback } from '../../../hooks/useFeedback';
import { RADIUS_MAX_M, RADIUS_MIN_M, radiusLimits } from '../../../hooks/useValidatorForm';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { siteService } from '../../../services/siteService';
import type { WorkSite } from '../../../types';
import { pickAddress } from '../../../utils/address';
import { metersText } from '../../../utils/numbers';

/** Radios sugeridos (m): de una oficina a una planta o un predio grande. */
const RADIUS_SUGGESTIONS = [50, 100, 200, 300, 500, 1000];

/** Textos del estado de un sitio (activar, desactivar, eliminar), en el idioma activo. */
const statusTexts = (name: string): RecordStatusTexts => ({
  title: translate('sites.status.title'),
  activeMeaning: translate('sites.status.activeMeaning'),
  inactiveMeaning: translate('sites.status.inactiveMeaning'),
  deactivateWarning: translate('sites.status.deactivateWarning'),
  removeWarning: translate('sites.status.removeWarning'),
  activateQuestion: translate('sites.status.activateQuestion', { name }),
  deactivateQuestion: translate('sites.status.deactivateQuestion', { name }),
  removeQuestion: translate('sites.status.removeQuestion', { name }),
  activated: translate('sites.status.activated'),
  deactivated: translate('sites.status.deactivated'),
  removed: translate('sites.status.removed'),
  inUse: translate('sites.status.inUse'),
  inUseCodes: ['SITE_IN_USE', 'SITE_HAS_RECORDS'],
});

/**
 * Alta (/company/sites/new) o edición (/company/sites/:id/edit) de un punto de verificación: su nombre,
 * su domicilio con el punto en el mapa y el radio desde ese punto en que una verificación cuenta como «en sitio».
 * Un sitio en «Eliminados» no se edita: solo su aviso con «Restaurar».
 */
export function SiteFormPage() {
  const t = useT();
  const { id } = useParams();
  return (
    <RecordLoader
      id={id ? Number(id) : null}
      load={(siteId, signal) => siteService.get(siteId, signal)}
      errorTitle={() => translate('sites.form.loadError')}
      failed={{ title: t('sites.form.editTitle'), backTo: paths.company.sites, backLabel: t('sites.list.title') }}
    >
      {(site, replace) => (site?.deleted_at ? <DeletedSite record={site} onRestored={replace} /> : <SiteFormView key={site?.id ?? 'new'} original={site} />)}
    </RecordLoader>
  );
}

function SiteFormView({ original }: { original: WorkSite | null }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useSiteForm(original);
  const [active, setActive] = useState(original?.active ?? true);
  const back = () => void navigate(paths.company.sites);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void form.save((saved) => {
      const notice = original ? 'updated' : 'created';
      void feedback.success(
        () => translate(`sites.form.${notice}.title`),
        () => translate(`sites.form.${notice}.text`, { name: saved.name, rule: translate('sites.form.rule', { distance: metersText(saved.radius_m) }) }),
      );
      back();
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={original ? t('sites.form.editTitle') : t('sites.form.newTitle')}
          subtitle={original?.name ?? t('sites.form.newSubtitle')}
          backTo={paths.company.sites}
          backLabel={t('sites.list.title')}
        />
        <SiteSection form={form} />
        <LocationSection form={form} />
        {original && (
          <RecordStatus
            name={original.name}
            active={active}
            texts={() => statusTexts(original.name)}
            setStatus={(next) => siteService.setStatus(original.id, next)}
            remove={() => siteService.remove(original.id)}
            onStatus={setActive}
            onRemoved={() => void navigate(paths.company.sites, { replace: true })}
          />
        )}
        <FormFooter submitLabel={original ? t('common.actions.saveChanges') : t('sites.form.create')} submitIcon={original ? <Save size={20} /> : <MapPinPlus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}

/** Nombre del sitio y radio de la geocerca (con radios sugeridos). */
function SiteSection({ form }: { form: SiteForm }) {
  const t = useT();
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title={t('sites.form.sections.site')} icon={<MapPin size={20} />}>
      <div className="form-grid">
        <FormField
          label={t('sites.form.name')}
          icon={<MapPin size={18} />}
          required
          maxLength={SITE_NAME_MAX}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint={t('sites.form.nameHint')}
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="field-stack">
          <NumberField
            label={t('sites.form.radius')}
            icon={<Ruler size={18} />}
            unit="m"
            step={10}
            required
            min={RADIUS_MIN_M}
            max={RADIUS_MAX_M}
            disabled={saving}
            value={values.radius}
            error={errors.radius}
            hint={t('sites.form.radiusHint', radiusLimits())}
            onBlur={() => touch('radius')}
            onChange={(value) => set('radius', value)}
          />
          <QuickChoices
            label={t('sites.form.suggestedRadii')}
            value={values.radius}
            choices={RADIUS_SUGGESTIONS.map((meters) => ({ value: String(meters), text: metersText(meters) }))}
            disabled={saving}
            onPick={(value) => set('radius', value)}
          />
        </div>
      </div>
      <p className="small muted inline-note">
        <Radar size={16} aria-hidden /> {t('sites.form.onSiteNote')}
      </p>
      <Switch
        icon={<QrCode size={20} />}
        label={t('sites.presence.label')}
        description={t('sites.presence.hint')}
        checked={form.presenceCode}
        disabled={saving}
        onChange={form.setPresenceCode}
      />
    </PanelSection>
  );
}

/** Domicilio y punto del sitio: el círculo del mapa muestra el radio en vivo. */
function LocationSection({ form }: { form: SiteForm }) {
  const t = useT();
  const { values, errors, set, touch, saving, point, radius, pointError, setPoint, applyAddress } = form;
  const address = pickAddress(values);
  return (
    <PanelSection title={t('sites.form.sections.location')} icon={<MapPinHouse size={20} />}>
      <p className="muted small">{t('sites.form.locationIntro')}</p>
      <LocationPicker address={address} point={point} radius={radius} error={pointError} onPoint={setPoint} onAddress={applyAddress} disabled={saving} pointOf="site" />
      <AddressFields values={address} errors={errors} disabled={saving} onChange={set} onTouch={touch} />
    </PanelSection>
  );
}
