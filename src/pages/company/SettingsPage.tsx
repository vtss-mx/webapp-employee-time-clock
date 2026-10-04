import { BrainCircuit, Film, Fingerprint, Gauge, History, ImageOff, Images, Lock, LockKeyhole, MonitorSmartphone, QrCode, ScanFace, ScanLine, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Timer, Users, VideoOff } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ruledAccessories, type AccessoryRule } from '../../components/accessories';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { PolicyTuning, type TuningKey } from '../../components/settings/PolicyTuning';
import { formatConfidence } from '../../utils/format';
import { ConfirmDialog } from '../../components/Modal';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { publishPolicy } from '../../hooks/useVerificationPolicy';
import { settingsService } from '../../services/settingsService';
import type { AccessoryItem, VerificationPolicy, VerificationPolicyUpdate } from '../../types';

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
  | 'adaptive_learning';

interface Option {
  key: PolicyKey;
  icon: ReactNode;
  label: string;
  on: string;
  off: string;
  /** Desactivarla reduce la seguridad: se pide confirmación. */
  security?: boolean;
  /** Texto de la confirmación al desactivarla (por defecto, el de suplantación de identidad). */
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
    options: ruledAccessories(accessories).map(({ item, rule, icon: Icon }) => ({
      key: rule,
      icon: <Icon size={20} />,
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
      { key: 'liveness_challenge', icon: <Fingerprint size={20} />, label: 'Prueba de vida', on: 'La persona gira la cabeza en una dirección aleatoria.', off: 'Sin reto de giro de cabeza.', security: true },
      { key: 'anti_spoofing', icon: <ScanFace size={20} />, label: 'Anti-spoofing', on: 'Detecta fotos impresas, pantallas y videos frente a la cámara.', off: 'No se analizan fotos ni pantallas.', security: true },
    ],
  },
  {
    title: 'Candados contra suplantación',
    icon: <LockKeyhole size={20} />,
    hint: 'Cada candado cierra una forma distinta de engañar al reconocimiento facial. Recomendado mantenerlos todos activos.',
    options: [
      { key: 'block_virtual_cameras', icon: <VideoOff size={20} />, label: 'Bloquear cámaras virtuales', on: 'Se rechazan programas que fingen ser una cámara (OBS, ManyCam...) para transmitir un video o una foto.', off: 'Se acepta cualquier cámara, incluidas las virtuales.', security: true },
      { key: 'reject_foreign_images', icon: <ImageOff size={20} />, label: 'Solo capturas en vivo', on: 'Se rechazan imágenes de la galería o editadas (traen datos de otra cámara o de un editor).', off: 'Se aceptan imágenes con datos de otra cámara o de un editor.', security: true },
      { key: 'detect_static_captures', icon: <Images size={20} />, label: 'Detectar fotos fijas', on: 'Se rechaza un intento si sus capturas son idénticas (una foto enviada varias veces).', off: 'No se comparan las capturas entre sí.', security: true },
      { key: 'detect_replays', icon: <History size={20} />, label: 'Detectar capturas reutilizadas', on: 'Cada captura sirve una sola vez: reenviar capturas guardadas o interceptadas se rechaza.', off: 'No se recuerdan las capturas recibidas.', security: true },
      { key: 'check_capture_continuity', icon: <Film size={20} />, label: 'Exigir una sola toma', on: 'Todas las capturas deben salir de la misma cámara, con el rostro y la luz continuos al girar.', off: 'No se compara la cámara, el encuadre ni la luz entre capturas.', security: true },
      { key: 'enforce_human_timing', icon: <Timer size={20} />, label: 'Tiempo humano en la prueba de vida', on: 'Se rechazan respuestas al reto más rápidas de lo que tarda una persona (programas automáticos).', off: 'No se mide cuánto tarda la respuesta al reto.', security: true },
      { key: 'detect_duplicate_faces', icon: <Users size={20} />, label: 'Detectar rostros duplicados', on: 'Al registrar un rostro ya aprobado en otro empleado: se marca para revisión o, en persona, se bloquea.', off: 'No se compara el registro con los demás empleados.', security: true },
      { key: 'lockout_enabled', icon: <Lock size={20} />, label: 'Bloqueo por intentos fallidos', on: 'Tras varios intentos fallidos o sospechosos seguidos se bloquea temporalmente (ajústalo abajo).', off: 'Se puede intentar sin límite (solo el límite general de peticiones).', security: true },
    ],
  },
  {
    title: 'Aprendizaje continuo',
    icon: <BrainCircuit size={20} />,
    hint: 'El reconocimiento facial mejora con el uso: cada identificación segura le enseña cómo luce hoy cada empleado. Las muestras que validaste nunca se reemplazan.',
    options: [
      {
        key: 'adaptive_learning',
        icon: <Sparkles size={20} />,
        label: 'Aprender de cada identificación segura',
        on: 'Solo aprende de identificaciones con prueba de vida y confianza holgada: otra luz, otra cámara, peinado, barba o el paso del tiempo. Lo aprendido que deja de servir se reemplaza solo.',
        off: 'Cada empleado se compara solo con las muestras de su registro aprobado.',
      },
    ],
  },
  {
    title: 'Métodos de identificación',
    icon: <QrCode size={20} />,
    hint: 'Formas en que los empleados pueden identificarse.',
    options: [{ key: 'qr_enabled', icon: <QrCode size={20} />, label: 'Verificación con código QR', on: 'Los empleados muestran en su teléfono un QR dinámico: cambia solo y cada código sirve una sola vez.', off: 'Solo reconocimiento facial.' }],
  },
  {
    title: 'Dispositivos de los validadores',
    icon: <Smartphone size={20} />,
    hint: 'Solo los validadores de identidad tienen restricciones de dispositivo. Empleados y administradores usan la aplicación desde cualquier dispositivo.',
    options: [
      {
        key: 'validator_device_approval',
        icon: <MonitorSmartphone size={20} />,
        label: 'Autorizar dispositivos de validadores',
        on: 'Cada tableta o teléfono en que inicia sesión un validador queda por autorizar (Validadores › Dispositivos) y se verifica con su llave en cada inicio de sesión.',
        off: 'Los validadores pueden iniciar sesión en cualquier dispositivo con su correo y contraseña.',
        security: true,
        confirmMessage:
          'Cualquier persona con el correo y la contraseña de un validador podrá operar desde cualquier dispositivo. ¿Deseas continuar?',
      },
      {
        key: 'validator_mobile_only',
        icon: <ScanLine size={20} />,
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

/** COMPANY: política de verificación (se aplica en segundos a toda la empresa). */
export function SettingsPage() {
  const { data: policy, setData: setPolicy, error, retry } = useResource((signal) => settingsService.getVerificationPolicy(signal), 'policy', 'No se pudo cargar la configuración');

  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Configuración" subtitle="Política de verificación de identidad de tu empresa" />
        {policy ? (
          <PolicyEditor policy={policy} onChange={setPolicy} />
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
function PolicyEditor({ policy, onChange: setPolicy }: { policy: VerificationPolicy; onChange: (policy: VerificationPolicy) => void }) {
  const { accessories } = useCatalogs();
  const sections = useMemo(() => [faceSection(accessories), ...POLICY_SECTIONS], [accessories]);
  const { busy: saving, run } = useAction<PolicyKey | TuningKey | 'min_confidence'>();
  const [confirm, setConfirm] = useState<Option | null>(null);

  /** Guarda un cambio: se ve de inmediato (optimista), se publica a toda la app y se revierte si el servidor no lo acepta. */
  const apply = (key: PolicyKey | TuningKey | 'min_confidence', changes: VerificationPolicyUpdate, notice: SuccessNotice) => {
    const previous = policy;
    setPolicy({ ...policy, ...changes }); // optimista
    void run(() => settingsService.updateVerificationPolicy(changes), {
      busy: key,
      errorTitle: 'No se pudo guardar',
      success: notice,
      onSuccess: (updated) => {
        setPolicy(updated);
        publishPolicy(updated);
      },
      onError: () => setPolicy(previous),
    });
  };

  const save = (option: Option, value: boolean) =>
    apply(option.key, { [option.key]: value }, [value ? `${option.label}: activado` : `${option.label}: desactivado`, value ? option.on : option.off]);
  const saveConfidence = (value: number) =>
    apply('min_confidence', { min_confidence: value }, ['Nivel de confianza actualizado', `Se exigirá ${formatConfidence(value)} en cada verificación facial.`]);

  const onToggle = (option: Option, value: boolean) => {
    if (option.security && !value) setConfirm(option);
    else save(option, value);
  };

  return (
    <>
      <PanelSection title="Nivel de confianza" icon={<Gauge size={20} />}>
        <p className="muted small">
          Probabilidad mínima de que la persona frente a la cámara sea el empleado registrado. Cada verificación
          informa su confianza y queda en el historial del empleado.
        </p>
        <ConfidenceSlider value={policy.min_confidence} busy={saving === 'min_confidence'} onSave={saveConfidence} />
      </PanelSection>
      {sections.map((section) => (
        <PanelSection key={section.title} title={section.title} icon={section.icon}>
          <p className="muted small">{section.hint}</p>
          {section.options.map((option) => (
            <Switch
              key={option.key}
              icon={option.icon}
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
        <PolicyTuning policy={policy} saving={saving} onSave={(key, changes, title, detail) => apply(key, changes, [title, detail])} />
      </PanelSection>
      {confirm && (
        <ConfirmDialog
          open
          title={`Desactivar ${confirm.label.toLowerCase()}`}
          message={confirm.confirmMessage ?? SPOOFING_WARNING}
          confirmLabel="Desactivar"
          tone="danger"
          onConfirm={() => {
            save(confirm, false);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
