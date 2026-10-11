import {
  Aperture,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  Clapperboard,
  FileImage,
  Film,
  Fingerprint,
  FlaskConical,
  Gauge,
  History,
  ImageOff,
  Images,
  Layers,
  Lock,
  LockKeyhole,
  MapPin,
  Mic,
  MonitorSmartphone,
  Power,
  PowerOff,
  QrCode,
  Radar,
  Route,
  Save,
  ScanFace,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Timer,
  type LucideIcon,
  Users,
  VideoOff,
  Volume2,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { ReasonField } from '../../components/ReasonField';
import { FaceLearningPanel } from '../../components/FaceLearningPanel';
import { EnrollmentStepsSection, type EnrollmentStepsSave } from '../../components/policy/EnrollmentStepsSection';
import { PolicyChanges } from '../../components/policy/PolicyChanges';
import { ruledAccessories, type AccessoryRule } from '../../components/accessories';
import { appliesTo, footnote, onOff, withChanges } from '../../components/policy/policyFields';
import { PolicyPresets, presetConfirm } from '../../components/policy/PolicyPresets';
import { PresenceSection } from '../../components/policy/PresenceSection';
import { RiskEngineSection } from '../../components/policy/RiskEngineSection';
import { policyRiskConfirm } from '../../components/policy/policyRiskConfirm';
import { RiskSimulationPanel } from '../../components/policy/RiskSimulation';
import { VoiceGuidanceSection } from '../../components/policy/VoiceGuidanceSection';
import { PolicyTuning, type TuningKey, type TuningSave } from '../../components/settings/PolicyTuning';
import { formatConfidence } from '../../utils/format';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { t, Trans, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { AccessoryItem, AdminPolicyUpdate, AdminVerificationPolicy, CatalogItem, PolicyUpdateResult } from '../../types';
import type { ConfirmInput, ConfirmSource } from '../../types/confirm';
import type { Messages } from '../../types/i18n';

type PolicyKey =
  | 'block_glasses'
  | 'block_headwear'
  | 'block_mask'
  | 'liveness_challenge'
  | 'enable_turn_right'
  | 'enable_turn_left'
  | 'enable_look_up'
  | 'enable_look_down'
  | 'anti_spoofing'
  | 'qr_enabled'
  | 'validator_mobile_only'
  | 'block_virtual_cameras'
  | 'reject_foreign_images'
  | 'detect_static_captures'
  | 'detect_replays'
  | 'check_capture_continuity'
  | 'enforce_human_timing'
  | 'detect_duplicate_faces'
  | 'lockout_enabled'
  | 'validator_device_approval'
  | 'adaptive_learning'
  | 'detect_impossible_travel'
  | 'risk_engine'
  | 'fraud_evidence'
  | 'flash_paced'
  | 'capture_burst'
  | 'voice_verification'
  | 'voice_guidance_enabled';

/** Las reglas con texto propio en `policy.options` (las de accesorios usan `policy.accessories`). */
type OptionId = keyof Messages['policy']['options'];
type AccessoryId = Exclude<keyof Messages['policy']['accessories'], 'remove'>;
type WarningId = keyof Messages['policy']['warnings'];
type SectionId = keyof Messages['policy']['sections'];

/** Textos de una regla en el idioma activo: se piden al dibujarse (un popup abierto sigue al idioma). */
interface OptionText {
  label: string;
  on: string;
  off: string;
}

interface Option {
  key: PolicyKey;
  /** Ícono del interruptor y de su confirmación. */
  Icon: LucideIcon;
  text: () => OptionText;
  /** Desactivarla reduce la seguridad: su confirmación lo advierte. */
  security?: boolean;
  /** Advertencia de la confirmación al desactivarla (por defecto, la de suplantación de identidad). */
  warning?: WarningId;
}

interface Section {
  id: SectionId;
  icon: ReactNode;
  options: Option[];
}

/** Una regla con sus textos en `policy.options.<id>`. */
function option(key: PolicyKey, id: OptionId, Icon: LucideIcon, extra: Pick<Option, 'security' | 'warning'> = {}): Option {
  return { key, Icon, ...extra, text: () => ({ label: t(`policy.options.${id}.label`), on: t(`policy.options.${id}.on`), off: t(`policy.options.${id}.off`) }) };
}

/** Efecto de cada regla de accesorios; el nombre del interruptor y su ícono salen del catálogo. */
const ACCESSORY_TEXT: Record<AccessoryRule, AccessoryId> = {
  block_glasses: 'blockGlasses',
  block_headwear: 'blockHeadwear',
  block_mask: 'blockMask',
};

/**
 * Requisitos del rostro: un interruptor por accesorio activo del catálogo («Retirar los lentes», «Retirar el
 * cubrebocas»). Los lentes nacen apagados en toda empresa (decisión del dueño, 2026-10-07; migración 0082) y ningún
 * nivel predefinido los enciende; encendidos, el servidor los respeta como a los demás.
 */
function faceSection(accessories: AccessoryItem[]): Section {
  return {
    id: 'face',
    icon: <ScanFace size={20} />,
    options: ruledAccessories(accessories).map(({ item, rule, icon }) => {
      const id = ACCESSORY_TEXT[rule];
      return {
        key: rule,
        Icon: icon,
        text: () => ({ label: t('policy.accessories.remove', { phrase: item.phrase }), on: t(`policy.accessories.${id}.on`), off: t(`policy.accessories.${id}.off`) }),
      };
    }),
  };
}

const security = { security: true };

const POLICY_SECTIONS: Section[] = [
  {
    id: 'security',
    icon: <ShieldCheck size={20} />,
    options: [
      option('liveness_challenge', 'livenessChallenge', Fingerprint, security),
      // Movimientos de la prueba de vida (el servidor arma el reto con los encendidos). Apagar uno relaja la seguridad
      // (regla de dos personas) y el servidor exige que queden al menos dos (422 `LIVENESS_MOVES_MIN`).
      option('enable_turn_right', 'enableTurnRight', ArrowRight, security),
      option('enable_turn_left', 'enableTurnLeft', ArrowLeft, security),
      option('enable_look_up', 'enableLookUp', ArrowUp, security),
      option('enable_look_down', 'enableLookDown', ArrowDown, security),
      option('anti_spoofing', 'antiSpoofing', ScanFace, security),
    ],
  },
  {
    id: 'locks',
    icon: <LockKeyhole size={20} />,
    options: [
      option('block_virtual_cameras', 'blockVirtualCameras', VideoOff, security),
      option('reject_foreign_images', 'rejectForeignImages', ImageOff, security),
      option('detect_static_captures', 'detectStaticCaptures', Images, security),
      option('detect_replays', 'detectReplays', History, security),
      option('check_capture_continuity', 'checkCaptureContinuity', Film, security),
      option('enforce_human_timing', 'enforceHumanTiming', Timer, security),
      option('detect_duplicate_faces', 'detectDuplicateFaces', Users, security),
      option('lockout_enabled', 'lockoutEnabled', Lock, security),
    ],
  },
  { id: 'learning', icon: <BrainCircuit size={20} />, options: [option('adaptive_learning', 'adaptiveLearning', Sparkles)] },
  {
    id: 'location',
    icon: <MapPin size={20} />,
    options: [option('detect_impossible_travel', 'detectImpossibleTravel', Route, { security: true, warning: 'impossibleTravel' })],
  },
  {
    id: 'methods',
    icon: <QrCode size={20} />,
    options: [option('qr_enabled', 'qrEnabled', QrCode)],
  },
  {
    id: 'antifraud',
    icon: <ShieldAlert size={20} />,
    options: [
      option('risk_engine', 'riskEngine', Radar, { security: true, warning: 'riskEngine' }),
      option('fraud_evidence', 'fraudEvidence', FileImage),
      // Verificación por voz y video del registro (decisión del dueño, 2026-10-06): apagarla relaja (dos personas).
      option('voice_verification', 'voiceVerification', Mic, { security: true, warning: 'voiceVerification' }),
    ],
  },
  {
    id: 'capture',
    icon: <Aperture size={20} />,
    // Destello dictado por el servidor (antifraude 2a): interruptor del ADMIN, apagado en empresas nuevas; encendido, el
    // flujo de captura activa el destello que el servidor dicta en cada reto.
    options: [option('flash_paced', 'flashPaced', Zap), option('capture_burst', 'captureBurst', Clapperboard, { security: true, warning: 'captureProtocol' })],
  },
  {
    id: 'devices',
    icon: <Smartphone size={20} />,
    options: [
      option('validator_device_approval', 'validatorDeviceApproval', MonitorSmartphone, { security: true, warning: 'deviceApproval' }),
      option('validator_mobile_only', 'validatorMobileOnly', ScanLine, { security: true, warning: 'mobileOnly' }),
    ],
  },
];

/**
 * Guía por voz del registro (decisión del dueño, 2026-10-08): interruptor NEUTRAL (sin `security`: no es un candado ni
 * lleva la insignia de recomendado). Su confirmación y su aviso reutilizan el mecanismo de cualquier interruptor.
 */
const VOICE_GUIDANCE = option('voice_guidance_enabled', 'voiceGuidance', Volume2);

/**
 * Lo que se puede estar guardando (su control queda ocupado): una regla (`PolicyKey`), un ajuste (también del motor
 * de riesgo, `TuningKey`), un nivel de confianza (`min_confidence`, `identify_confidence`) o un nivel predefinido
 * (`preset`). Los nombres de los campos son textos libres del backend: basta un `string`.
 */
type PolicyField = TuningKey;

/**
 * Encender o apagar una regla: su estado "antes → después" y qué hará. Lo que protege más es verde; lo que
 * protege menos es rojo y, si es una protección, lleva su advertencia (suplantación, ubicación falsa,
 * dispositivos...) y, con la regla de dos personas, que otro ADMIN debe aprobarlo.
 */
function switchConfirm(option: Option, value: boolean, company: string, twoPerson: boolean): ConfirmInput {
  const { label, on, off } = option.text();
  const safer = value;
  const risky = Boolean(option.security) && !value;
  return {
    kind: 'edit',
    tone: safer ? 'success' : 'danger',
    icon: <option.Icon size={30} />,
    eyebrow: t(option.security ? 'policy.toggle.eyebrowSecurity' : 'policy.toggle.eyebrow'),
    title: t(value ? 'policy.toggle.activateTitle' : 'policy.toggle.deactivateTitle', { label }),
    message: risky ? t(`policy.warnings.${option.warning ?? 'spoofing'}`) : value ? on : off,
    changes: [{ label, before: onOff(!value), after: onOff(value) }],
    note: footnote(company, risky, twoPerson),
    confirmLabel: t(value ? 'policy.toggle.activate' : 'policy.toggle.deactivate'),
    confirmIcon: value ? <Power size={18} /> : <PowerOff size={18} />,
  };
}

/** Aviso al encender o apagar una regla: "Prueba de vida: activado" y qué hace ahora. */
function switchNotice(option: Option, value: boolean): SuccessNotice {
  const { label, on, off } = option.text();
  return [t(value ? 'policy.toggle.activated' : 'policy.toggle.deactivated', { label }), value ? on : off];
}

/**
 * Cambiar un ajuste de los candados: "antes → después"; si protege menos, la advertencia en rojo; si
 * tiene una advertencia propia (exigir una prueba de presencia sin preparar los dispositivos), en ámbar y al pie.
 */
function tuningConfirm({ change, detail, relaxes, warning }: TuningSave, company: string, twoPerson: boolean): ConfirmInput {
  const caution = relaxes ? t('policy.tuning.relaxes') : warning?.();
  const changed = change();
  const scope = footnote(company, relaxes, twoPerson);
  return {
    kind: 'edit',
    tone: relaxes ? 'danger' : warning ? 'warning' : 'primary',
    icon: <SlidersHorizontal size={30} />,
    eyebrow: t('policy.tuning.title'),
    title: t('policy.tuning.confirmTitle', { label: changed.label, value: changed.after }),
    message: detail(),
    changes: [changed],
    note: caution ? `${caution} ${scope}` : scope,
    confirmLabel: t('policy.tuning.confirmLabel'),
    confirmIcon: <Save size={18} />,
  };
}

/**
 * Cambiar la voz de la guía por audio: siempre NEUTRAL (nunca relaja la seguridad ni pasa por la regla de dos
 * personas). Su confirmación es la del contexto de la guía por voz, no la de los candados de la prueba de vida.
 */
function voiceProfileConfirm({ change, detail }: TuningSave, company: string): ConfirmInput {
  const changed = change();
  return {
    kind: 'edit',
    tone: 'primary',
    icon: <Mic size={30} />,
    eyebrow: t('policy.voice.title'),
    title: t('policy.voice.profile.confirmTitle', { value: changed.after }),
    message: detail(),
    changes: [changed],
    note: appliesTo(company),
    confirmLabel: t('policy.voice.profile.confirmLabel'),
    confirmIcon: <Save size={18} />,
  };
}

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('policy.loadError');
const saveError = () => t('policy.saveError');
const confidenceNotice = (value: number): SuccessNotice => [t('policy.confidence.saved'), t('policy.confidence.savedText', { value: formatConfidence(value) })];
const identifyNotice = (value: number): SuccessNotice => [t('policy.confidence.identifySaved'), t('policy.confidence.identifySavedText', { value: formatConfidence(value) })];
const presetNotice = (preset: CatalogItem): SuccessNotice => [t('policy.presets.applied', { name: preset.name }), preset.description ?? ''];
/** El aviso según lo que pasó: aplicado (el suyo) o por aprobar de otro ADMIN (la política sigue igual). */
const outcome = (notice: () => SuccessNotice) => (result: PolicyUpdateResult): SuccessNotice =>
  result.change?.status === 'PENDING' ? [t('policy.governance.pendingTitle'), t('policy.governance.pendingText')] : notice();

interface PolicyEditorProps {
  companyId: number;
  /** Nombre de la empresa: las confirmaciones dicen a quién aplica cada cambio. */
  companyName: string;
  policy: AdminVerificationPolicy;
  onChange: (policy: AdminVerificationPolicy) => void;
}

/**
 * ADMIN: política de verificación de identidad de una empresa (/admin/companies/:id/policy). El ADMIN de
 * la plataforma es el responsable de configurarla; la empresa y su personal solo la leen. Cada cambio
 * aplica en segundos a toda la empresa.
 */
export function CompanyPolicyPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const { data, setData, error, retry } = useResource(
    (signal) => Promise.all([adminService.get(companyId, signal), adminService.policy(companyId, signal)]),
    companyId,
    loadError,
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('policy.title')}
          subtitle={data?.[0].name}
          backTo={paths.admin.company(companyId)}
          backLabel={data?.[0].name ?? t('common.fields.company')}
        />
        {data ? (
          <PolicyEditor companyId={companyId} companyName={data[0].name} policy={data[1]} onChange={(policy) => setData([data[0], policy])} />
        ) : (
          <PanelSection>{error ? <RetryState onRetry={retry} /> : <SkeletonRows rows={6} />}</PanelSection>
        )}
      </Panel>
    </div>
  );
}

/**
 * Controles de la política ya cargada: solo existen con ella, así que cada cambio parte siempre de
 * la política vigente (sin casos "aún no hay política" que nunca ocurren).
 */
function PolicyEditor({ companyId, companyName, policy, onChange: setPolicy }: PolicyEditorProps) {
  const t = useT();
  const { accessories } = useCatalogs();
  const sections = useMemo(() => [faceSection(accessories), ...POLICY_SECTIONS], [accessories]);
  const { busy: saving, run } = useAction<PolicyField>();
  /** Cambia con cada cambio pedido: el historial se vuelve a pedir. */
  const [version, setVersion] = useState(0);
  const [riskReason, setRiskReason] = useState('');
  const twoPerson = policy.two_person_rule;

  /** Lo que devolvió el servidor manda: si el cambio quedó por aprobar, la política sigue como estaba. */
  const applied = (result: PolicyUpdateResult) => {
    setPolicy(result.policy);
    if (result.change) setVersion((n) => n + 1);
  };

  /**
   * Guarda un cambio. Con `confirm` primero pregunta: cancelar no envía nada y el control queda como
   * estaba. Ya confirmado, se ve de inmediato (optimista) y queda lo que responda el servidor: aplicado, o
   * como estaba si relaja la seguridad y espera a otro ADMIN (el aviso lo dice); si falla, se revierte. La
   * confirmación y el aviso se arman al dibujarse: un popup abierto sigue al idioma activo.
   */
  const apply = (key: PolicyField, changes: AdminPolicyUpdate, notice: () => SuccessNotice, confirm?: ConfirmSource, onError?: (error: unknown) => void) => {
    const previous = policy;
    void run(
      () => {
        setPolicy(withChanges(policy, changes)); // optimista, solo después de confirmar
        return adminService.updatePolicy(companyId, riskReason.trim() ? { ...changes, reason: riskReason } : changes);
      },
      {
        busy: key,
        confirm: policyRiskConfirm(confirm, riskReason),
        errorTitle: saveError,
        success: outcome(notice),
        onSuccess: applied,
        onError: (error) => {
          setPolicy(previous);
          onError?.(error); // un control con error de campo (los pasos del registro: 422 INVALID_ENROLLMENT_STEPS)
        },
      },
    );
  };

  const onToggle = (option: Option, value: boolean) =>
    apply(
      option.key,
      { [option.key]: value },
      () => switchNotice(option, value),
      () => switchConfirm(option, value, companyName, twoPerson),
    );
  // Los niveles de confianza los confirma su propio control (con el nivel "antes → después") antes de llegar aquí.
  const saveConfidence = (value: number) => apply('min_confidence', { min_confidence: value }, () => confidenceNotice(value));
  const saveIdentifyConfidence = (value: number) =>
    apply('identify_confidence', { identify_confidence: value }, () => identifyNotice(Math.max(value, policy.min_confidence)));
  const saveTuning = (tuning: TuningSave) =>
    apply(tuning.key, tuning.changes, () => [tuning.title(), tuning.detail()], () => tuningConfirm(tuning, companyName, twoPerson));
  // Guía por voz (decisión del dueño, 2026-10-08): encenderla es un interruptor neutral; la voz se confirma sin la
  // regla de dos personas (cambiarla nunca relaja la seguridad).
  const onToggleVoiceGuidance = (value: boolean) => onToggle(VOICE_GUIDANCE, value);
  // Pasos del registro de identidad (decisión del dueño, 2026-10-08): la sección arma su confirmación y su aviso y
  // recibe el error del servidor para marcarlo en el campo (422 `INVALID_ENROLLMENT_STEPS`).
  const saveEnrollmentSteps = ({ steps, confirm, notice, onError }: EnrollmentStepsSave) =>
    apply('enrollment_steps', { enrollment_steps: steps }, notice, confirm, onError);
  const saveVoiceProfile = (save: TuningSave) =>
    apply('voice_profile', save.changes, () => [save.title(), save.detail()], () => voiceProfileConfirm(save, companyName));
  const applyPreset = (preset: CatalogItem) =>
    void run(() => adminService.applyPolicyPreset(companyId, preset.code, riskReason.trim() || undefined), {
      busy: 'preset',
      confirm: policyRiskConfirm(() => presetConfirm(preset, companyName, twoPerson), riskReason),
      errorTitle: saveError,
      success: outcome(() => presetNotice(preset)),
      onSuccess: applied,
    });

  return (
    <>
      <PanelSection title={t('policy.presets.title')} icon={<Layers size={20} />}>
        <ReasonField label={t('policy.risk.changeReason.label')} hint={t('policy.risk.changeReason.hint')} value={riskReason} onChange={setRiskReason} required disabled={saving !== null} />
        <p className="muted small">{t('policy.presets.hint')}</p>
        <PolicyPresets policy={policy} busy={saving === 'preset'} onApply={applyPreset} />
      </PanelSection>
      <PanelSection title={t('policy.confidence.title')} icon={<Gauge size={20} />}>
        <p className="muted small">{t('policy.confidence.intro')}</p>
        <ConfidenceSlider value={policy.min_confidence} busy={saving === 'min_confidence'} onSave={saveConfidence} />
        <p className="muted small">
          <Trans k="policy.confidence.identifyIntro" values={{ lead: <strong>{t('policy.confidence.identifyLead')}</strong> }} />
        </p>
        <ConfidenceSlider
          label={() => t('policy.confidence.identifyLabel')}
          value={policy.identify_confidence}
          busy={saving === 'identify_confidence'}
          onSave={saveIdentifyConfidence}
        />
      </PanelSection>
      {sections.map((section) => (
        <PanelSection key={section.id} title={t(`policy.sections.${section.id}.title`)} icon={section.icon}>
          <p className="muted small">{t(`policy.sections.${section.id}.hint`)}</p>
          {section.options.map((option) => {
            const { label, on, off } = option.text();
            return (
              <Switch
                key={option.key}
                icon={<option.Icon size={20} />}
                label={label}
                badge={option.security ? <span className="badge badge--info">{t('policy.recommended')}</span> : null}
                description={policy[option.key] ? on : off}
                checked={policy[option.key]}
                busy={saving === option.key}
                onChange={(value) => onToggle(option, value)}
              />
            );
          })}
        </PanelSection>
      ))}
      <PanelSection title={t('policy.tuning.title')} icon={<SlidersHorizontal size={20} />}>
        <p className="muted small">{t('policy.tuning.hint')}</p>
        <PolicyTuning policy={policy} saving={saving} onSave={saveTuning} />
      </PanelSection>
      <EnrollmentStepsSection policy={policy} companyName={companyName} saving={saving} onSave={saveEnrollmentSteps} />
      <VoiceGuidanceSection policy={policy} saving={saving} onToggle={onToggleVoiceGuidance} onSaveProfile={saveVoiceProfile} />
      <PanelSection title={t('policy.risk.title')} icon={<Radar size={20} />}>
        <p className="muted small">{t('policy.risk.hint')}</p>
        <RiskEngineSection policy={policy} saving={saving} onSave={saveTuning} />
      </PanelSection>
      <PresenceSection policy={policy} saving={saving} onSave={saveTuning} />
      <PanelSection title={t('policy.simulation.title')} icon={<FlaskConical size={20} />}>
        <RiskSimulationPanel companyId={companyId} policy={policy} />
      </PanelSection>
      <PanelSection
        title={t('policy.changes.title')}
        icon={<History size={20} />}
        aside={policy.pending_changes > 0 && <span className="badge badge--warning badge--live">{t('policy.changes.pending', { count: policy.pending_changes })}</span>}
      >
        <p className="muted small">{t(twoPerson ? 'policy.changes.hintTwoPerson' : 'policy.changes.hint')}</p>
        <PolicyChanges
          companyId={companyId}
          companyName={companyName}
          policy={policy}
          version={version}
          onApproved={(result) => setPolicy(result.policy)}
          onCancelled={() => setPolicy({ ...policy, pending_changes: Math.max(0, policy.pending_changes - 1) })}
        />
      </PanelSection>
      <FaceLearningPanel companyId={companyId} enabled={policy.adaptive_learning} />
    </>
  );
}
