import {
  BrainCircuit,
  Film,
  Fingerprint,
  Gauge,
  History,
  ImageOff,
  Images,
  Lock,
  LockKeyhole,
  MapPin,
  MonitorSmartphone,
  Power,
  PowerOff,
  QrCode,
  Route,
  Save,
  ScanFace,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Timer,
  Users,
  VideoOff,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ruledAccessories, type AccessoryRule } from '../../components/accessories';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { FaceLearningPanel } from '../../components/FaceLearningPanel';
import { PolicyTuning, type TuningKey, type TuningSave } from '../../components/settings/PolicyTuning';
import { formatConfidence } from '../../utils/format';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { AccessoryItem, VerificationPolicy, VerificationPolicyUpdate } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

type PolicyKey =
  | 'block_glasses'
  | 'block_headwear'
  | 'block_mask'
  | 'liveness_challenge'
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
  | 'detect_impossible_travel';

interface Option {
  key: PolicyKey;
  /** Ícono del interruptor y de su confirmación. */
  Icon: LucideIcon;
  label: string;
  on: string;
  off: string;
  /** Desactivarla reduce la seguridad: su confirmación lo advierte. */
  security?: boolean;
  /** Advertencia de la confirmación al desactivarla (por defecto, la de suplantación de identidad). */
  confirmMessage?: string;
}

const SPOOFING_WARNING =
  'Esto reduce la protección contra suplantación de identidad (fotos, pantallas o videos). ¿Deseas continuar?';

interface Section {
  title: string;
  icon: ReactNode;
  hint: string;
  options: Option[];
}

/** Efecto de cada regla de accesorios; el nombre del interruptor y su ícono salen del catálogo. */
const ACCESSORY_EFFECT: Record<AccessoryRule, Pick<Option, 'on' | 'off'>> = {
  block_glasses: { on: 'Se pedirá quitarse lentes (incluidos los de sol).', off: 'Se permite identificarse con lentes.' },
  block_headwear: {
    on: 'Se pedirá quitarse gorras, sombreros y viseras (salvo empleados exentos por motivos religiosos o médicos).',
    off: 'Se permite identificarse con prendas en la cabeza.',
  },
  block_mask: { on: 'Se pedirá quitarse el cubrebocas (verificación física de nariz y mejillas).', off: 'Se permite identificarse con cubrebocas (menor precisión).' },
};

/** Requisitos del rostro: un interruptor por accesorio activo del catálogo ("Retirar los lentes"). */
function faceSection(accessories: AccessoryItem[]): Section {
  return {
    title: 'Requisitos del rostro',
    icon: <ScanFace size={20} />,
    hint: 'Qué debe retirarse la persona antes de escanear. Lo que ocultes reduce la precisión del reconocimiento.',
    options: ruledAccessories(accessories).map(({ item, rule, icon }) => ({
      key: rule,
      Icon: icon,
      label: `Retirar ${item.phrase}`,
      ...ACCESSORY_EFFECT[rule],
    })),
  };
}

const POLICY_SECTIONS: Section[] = [
  {
    title: 'Seguridad',
    icon: <ShieldCheck size={20} />,
    hint: 'Protecciones contra suplantación de identidad. Recomendado mantenerlas activas.',
    options: [
      { key: 'liveness_challenge', Icon: Fingerprint, label: 'Prueba de vida', on: 'La persona gira la cabeza en una dirección aleatoria.', off: 'Sin reto de giro de cabeza.', security: true },
      { key: 'anti_spoofing', Icon: ScanFace, label: 'Anti-spoofing', on: 'Detecta fotos impresas, pantallas y videos frente a la cámara.', off: 'No se analizan fotos ni pantallas.', security: true },
    ],
  },
  {
    title: 'Candados contra suplantación',
    icon: <LockKeyhole size={20} />,
    hint: 'Cada candado cierra una forma distinta de engañar al reconocimiento facial. Recomendado mantenerlos todos activos.',
    options: [
      { key: 'block_virtual_cameras', Icon: VideoOff, label: 'Bloquear cámaras virtuales', on: 'Se rechazan programas que fingen ser una cámara (OBS, ManyCam...) para transmitir un video o una foto.', off: 'Se acepta cualquier cámara, incluidas las virtuales.', security: true },
      { key: 'reject_foreign_images', Icon: ImageOff, label: 'Solo capturas en vivo', on: 'Se rechazan imágenes de la galería o editadas (traen datos de otra cámara o de un editor).', off: 'Se aceptan imágenes con datos de otra cámara o de un editor.', security: true },
      { key: 'detect_static_captures', Icon: Images, label: 'Detectar fotos fijas', on: 'Se rechaza un intento si sus capturas son idénticas (una foto enviada varias veces).', off: 'No se comparan las capturas entre sí.', security: true },
      { key: 'detect_replays', Icon: History, label: 'Detectar capturas reutilizadas', on: 'Cada captura sirve una sola vez: reenviar capturas guardadas o interceptadas se rechaza.', off: 'No se recuerdan las capturas recibidas.', security: true },
      { key: 'check_capture_continuity', Icon: Film, label: 'Exigir una sola toma', on: 'Todas las capturas deben salir de la misma cámara, con el rostro y la luz continuos al girar.', off: 'No se compara la cámara, el encuadre ni la luz entre capturas.', security: true },
      { key: 'enforce_human_timing', Icon: Timer, label: 'Tiempo humano en la prueba de vida', on: 'Se rechazan respuestas al reto más rápidas de lo que tarda una persona (programas automáticos).', off: 'No se mide cuánto tarda la respuesta al reto.', security: true },
      { key: 'detect_duplicate_faces', Icon: Users, label: 'Detectar rostros duplicados', on: 'Al registrar un rostro ya aprobado en otro empleado: se marca para revisión o, en persona, se bloquea.', off: 'No se compara el registro con los demás empleados.', security: true },
      { key: 'lockout_enabled', Icon: Lock, label: 'Bloqueo por intentos fallidos', on: 'Tras varios intentos fallidos o sospechosos seguidos se bloquea temporalmente (ajústalo abajo).', off: 'Se puede intentar sin límite (solo el límite general de peticiones).', security: true },
    ],
  },
  {
    title: 'Aprendizaje continuo',
    icon: <BrainCircuit size={20} />,
    hint: 'El reconocimiento facial mejora con el uso: cada identificación segura le enseña cómo luce hoy cada empleado. Las muestras que validaste nunca se reemplazan.',
    options: [
      {
        key: 'adaptive_learning',
        Icon: Sparkles,
        label: 'Aprender de cada identificación segura',
        on: 'Solo aprende de identificaciones con prueba de vida y confianza holgada: otra luz, otra cámara, peinado, barba o el paso del tiempo. Lo aprendido que deja de servir se reemplaza solo.',
        off: 'Cada empleado se compara solo con las muestras de su registro aprobado.',
      },
    ],
  },
  {
    title: 'Ubicación de la asistencia',
    icon: <MapPin size={20} />,
    hint: 'Cada entrada, descanso y salida lleva la ubicación del teléfono; la hora la pone el servidor. Ajusta abajo la precisión exigida y la velocidad creíble.',
    options: [
      {
        key: 'detect_impossible_travel',
        Icon: Route,
        label: 'Detectar viajes imposibles',
        on: 'Se rechaza un registro hecho a una distancia que nadie recorre en ese tiempo desde el anterior (ubicación falsa o cuenta compartida).',
        off: 'No se compara la ubicación de un registro con la del anterior.',
        security: true,
        confirmMessage: 'Un registro con una ubicación falsa o desde otro lugar no se detectará por la distancia. ¿Deseas continuar?',
      },
    ],
  },
  {
    title: 'Métodos de identificación',
    icon: <QrCode size={20} />,
    hint: 'Formas en que los empleados pueden identificarse.',
    options: [{ key: 'qr_enabled', Icon: QrCode, label: 'Verificación con código QR', on: 'Los empleados muestran en su teléfono un QR dinámico: cambia solo y cada código sirve una sola vez.', off: 'Solo reconocimiento facial.' }],
  },
  {
    title: 'Dispositivos de los validadores',
    icon: <Smartphone size={20} />,
    hint: 'Solo los validadores de identidad tienen restricciones de dispositivo. Empleados y administradores usan la aplicación desde cualquier dispositivo.',
    options: [
      {
        key: 'validator_device_approval',
        Icon: MonitorSmartphone,
        label: 'Autorizar dispositivos de validadores',
        on: 'Cada tableta o teléfono en que inicia sesión un validador queda por autorizar (Validadores › Dispositivos) y se verifica con su llave en cada inicio de sesión.',
        off: 'Los validadores pueden iniciar sesión en cualquier dispositivo con su correo y contraseña.',
        security: true,
        confirmMessage:
          'Cualquier persona con el correo y la contraseña de un validador podrá operar desde cualquier dispositivo. ¿Deseas continuar?',
      },
      {
        key: 'validator_mobile_only',
        Icon: ScanLine,
        label: 'Validadores solo desde tableta o teléfono',
        on: 'Los validadores de identidad solo inician sesión en tabletas y teléfonos (cámara a la mano en el acceso).',
        off: 'Los validadores también pueden operar desde una computadora con cámara.',
        security: true,
        confirmMessage:
          'Los validadores podrán operar desde computadoras, cuya cámara suele ser de menor calidad y más fácil de engañar con fotos o pantallas. ¿Deseas continuar?',
      },
    ],
  },
];

/** Lo que se puede estar guardando: una regla, un ajuste de los candados o un nivel de confianza. */
type PolicyField = PolicyKey | TuningKey | 'min_confidence' | 'identify_confidence';

/** Alcance de cada cambio, al pie de su confirmación. */
const appliesTo = (company: string) => `Aplica en segundos a todo el personal de ${company}.`;

/**
 * Encender o apagar una regla: su estado "antes → después" y qué hará. Activar es verde; apagar es
 * rojo y, si es una protección, su advertencia (suplantación, ubicación falsa, dispositivos...).
 */
function switchConfirm(option: Option, value: boolean, company: string): ConfirmInput {
  const effect = value ? option.on : option.off;
  return {
    kind: 'edit',
    tone: value ? 'success' : 'danger',
    icon: <option.Icon size={30} />,
    eyebrow: option.security ? 'Protección recomendada' : 'Política de verificación',
    title: `¿${value ? 'Activar' : 'Desactivar'} «${option.label}»?`,
    message: option.security && !value ? (option.confirmMessage ?? SPOOFING_WARNING) : effect,
    changes: [{ label: option.label, before: value ? 'Desactivado' : 'Activado', after: value ? 'Activado' : 'Desactivado' }],
    note: appliesTo(company),
    confirmLabel: value ? 'Activar' : 'Desactivar',
    confirmIcon: value ? <Power size={18} /> : <PowerOff size={18} />,
  };
}

/**
 * Cambiar un ajuste de los candados: "antes → después"; si protege menos, la advertencia en rojo; si
 * tiene una advertencia propia (exigir el destello sin calibrar), en ámbar y al pie.
 */
function tuningConfirm({ change, detail, relaxes, warning }: TuningSave, company: string): ConfirmInput {
  const caution = relaxes ? 'Este valor protege menos contra la suplantación de identidad.' : warning;
  return {
    kind: 'edit',
    tone: relaxes ? 'danger' : warning ? 'warning' : 'primary',
    icon: <SlidersHorizontal size={30} />,
    eyebrow: 'Ajustes de los candados',
    title: `¿Cambiar «${change.label}» a ${change.after}?`,
    message: detail,
    changes: [change],
    note: caution ? `${caution} ${appliesTo(company)}` : appliesTo(company),
    confirmLabel: 'Guardar ajuste',
    confirmIcon: <Save size={18} />,
  };
}

interface PolicyEditorProps {
  companyId: number;
  /** Nombre de la empresa: las confirmaciones dicen a quién aplica cada cambio. */
  companyName: string;
  policy: VerificationPolicy;
  onChange: (policy: VerificationPolicy) => void;
}

/**
 * ADMIN: política de verificación de identidad de una empresa (/admin/companies/:id/policy). El ADMIN de
 * la plataforma es el responsable de configurarla; la empresa y su personal solo la leen. Cada cambio
 * aplica en segundos a toda la empresa.
 */
export function CompanyPolicyPage() {
  const companyId = Number(useParams().id);
  const { data, setData, error, retry } = useResource(
    (signal) => Promise.all([adminService.get(companyId, signal), adminService.policy(companyId, signal)]),
    companyId,
    'No se pudo cargar la política de verificación',
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Política de verificación de identidad"
          subtitle={data?.[0].name}
          backTo={paths.admin.company(companyId)}
          backLabel={data?.[0].name ?? 'Empresa'}
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
  const { accessories } = useCatalogs();
  const sections = useMemo(() => [faceSection(accessories), ...POLICY_SECTIONS], [accessories]);
  const { busy: saving, run } = useAction<PolicyField>();

  /**
   * Guarda un cambio. Con `confirm` primero pregunta: cancelar no envía nada y el control queda como
   * estaba. Ya confirmado, se ve de inmediato (optimista) y se revierte si el servidor no lo acepta.
   */
  const apply = (key: PolicyField, changes: VerificationPolicyUpdate, notice: SuccessNotice, confirm?: ConfirmInput) => {
    const previous = policy;
    void run(
      () => {
        setPolicy({ ...policy, ...changes }); // optimista, solo después de confirmar
        return adminService.updatePolicy(companyId, changes);
      },
      { busy: key, confirm, errorTitle: 'No se pudo guardar', success: notice, onSuccess: setPolicy, onError: () => setPolicy(previous) },
    );
  };

  const onToggle = (option: Option, value: boolean) =>
    apply(
      option.key,
      { [option.key]: value },
      [value ? `${option.label}: activado` : `${option.label}: desactivado`, value ? option.on : option.off],
      switchConfirm(option, value, companyName),
    );
  // Los niveles de confianza los confirma su propio control (con el nivel "antes → después") antes de llegar aquí.
  const saveConfidence = (value: number) =>
    apply('min_confidence', { min_confidence: value }, ['Nivel de confianza actualizado', `Se exigirá ${formatConfidence(value)} en cada verificación facial.`]);
  const saveIdentifyConfidence = (value: number) =>
    apply('identify_confidence', { identify_confidence: value }, [
      'Confianza para identificar actualizada',
      `Los validadores exigirán ${formatConfidence(Math.max(value, policy.min_confidence))} al identificar entre todos los empleados.`,
    ]);
  const saveTuning = (tuning: TuningSave) => apply(tuning.key, tuning.changes, [tuning.title, tuning.detail], tuningConfirm(tuning, companyName));

  return (
    <>
      <PanelSection title="Nivel de confianza" icon={<Gauge size={20} />}>
        <p className="muted small">
          Probabilidad mínima de que la persona frente a la cámara sea el empleado registrado. Cada verificación
          informa su confianza y queda en el historial del empleado.
        </p>
        <ConfidenceSlider value={policy.min_confidence} busy={saving === 'min_confidence'} onSave={saveConfidence} />
        <p className="muted small">
          <strong>Al identificar entre todos los empleados</strong> (validadores, sin saber quién es): buscar entre muchos multiplica
          las coincidencias falsas, así que se puede exigir más. Nunca rige por debajo del nivel anterior.
        </p>
        <ConfidenceSlider
          label="Nivel de confianza para identificar entre todos"
          value={policy.identify_confidence}
          busy={saving === 'identify_confidence'}
          onSave={saveIdentifyConfidence}
        />
      </PanelSection>
      {sections.map((section) => (
        <PanelSection key={section.title} title={section.title} icon={section.icon}>
          <p className="muted small">{section.hint}</p>
          {section.options.map((option) => (
            <Switch
              key={option.key}
              icon={<option.Icon size={20} />}
              label={option.label}
              badge={option.security ? <span className="badge badge--info">Recomendado</span> : null}
              description={policy[option.key] ? option.on : option.off}
              checked={policy[option.key]}
              busy={saving === option.key}
              onChange={(value) => onToggle(option, value)}
            />
          ))}
        </PanelSection>
      ))}
      <PanelSection title="Ajustes de los candados" icon={<SlidersHorizontal size={20} />}>
        <p className="muted small">Qué tan estricto es cada candado. Valores más estrictos protegen más, pero pueden pedir repetir la captura con más frecuencia.</p>
        <PolicyTuning policy={policy} saving={saving} onSave={saveTuning} />
      </PanelSection>
      <FaceLearningPanel companyId={companyId} enabled={policy.adaptive_learning} />
    </>
  );
}
