import { Ban, Fingerprint, Gauge, Glasses, HardHat, QrCode, ScanFace, ScanLine, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { formatConfidence } from '../../utils/format';
import { ConfirmDialog } from '../../components/Modal';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { publishPolicy } from '../../hooks/useVerificationPolicy';
import { settingsService } from '../../services/settingsService';
import type { VerificationPolicy } from '../../types';

type PolicyKey =
  | 'block_glasses'
  | 'block_headwear'
  | 'block_mask'
  | 'liveness_challenge'
  | 'anti_spoofing'
  | 'qr_enabled'
  | 'employee_mobile_only'
  | 'validator_mobile_only';

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

const SECTIONS: Array<{ title: string; icon: ReactNode; hint: string; options: Option[] }> = [
  {
    title: 'Requisitos del rostro',
    icon: <ScanFace size={20} />,
    hint: 'Qué debe retirarse la persona antes de escanear. Lo que ocultes reduce la precisión del reconocimiento.',
    options: [
      { key: 'block_glasses', icon: <Glasses size={20} />, label: 'Retirar lentes', on: 'Se pedirá quitarse lentes (incluidos los de sol).', off: 'Se permite identificarse con lentes.' },
      {
        key: 'block_headwear',
        icon: <HardHat size={20} />,
        label: 'Retirar gorra o sombrero',
        on: 'Se pedirá quitarse gorras, sombreros y viseras (salvo empleados exentos por motivos religiosos o médicos).',
        off: 'Se permite identificarse con prendas en la cabeza.',
      },
      { key: 'block_mask', icon: <Ban size={20} />, label: 'Retirar cubrebocas', on: 'Se pedirá quitarse el cubrebocas (verificación física de nariz y mejillas).', off: 'Se permite identificarse con cubrebocas (menor precisión).' },
    ],
  },
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
    title: 'Métodos de identificación',
    icon: <QrCode size={20} />,
    hint: 'Formas en que los empleados pueden identificarse.',
    options: [{ key: 'qr_enabled', icon: <QrCode size={20} />, label: 'Verificación con código QR', on: 'Los empleados pueden identificarse con su QR personal.', off: 'Solo reconocimiento facial.' }],
  },
  {
    title: 'Dispositivos permitidos',
    icon: <Smartphone size={20} />,
    hint: 'Desde dónde pueden usar la aplicación los empleados y los validadores. No aplica a administradores.',
    options: [
      {
        key: 'employee_mobile_only',
        icon: <Smartphone size={20} />,
        label: 'Solo desde teléfono celular',
        on: 'En computadoras y tabletas se indica al empleado que continúe desde su teléfono.',
        off: 'Los empleados pueden usar la aplicación desde cualquier dispositivo.',
        security: true,
        confirmMessage:
          'Los empleados podrán registrar su asistencia desde computadoras y tabletas compartidas, donde es más fácil suplantar a otra persona. ¿Deseas continuar?',
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
  const feedback = useFeedback();
  const [policy, setPolicy] = useState<VerificationPolicy | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const retry = () => setReload((n) => n + 1);
  useErrorPopup(error, { title: 'No se pudo cargar la configuración', retry });
  const [saving, setSaving] = useState<PolicyKey | 'min_confidence' | null>(null);
  const [confirm, setConfirm] = useState<Option | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    settingsService
      .getVerificationPolicy(controller.signal)
      .then(setPolicy)
      .catch((e: unknown) => !controller.signal.aborted && setError(e));
    return () => controller.abort();
  }, [reload]);

  const save = async (option: Option, value: boolean) => {
    if (!policy) return;
    const previous = policy;
    setPolicy({ ...policy, [option.key]: value }); // optimista
    setSaving(option.key);
    try {
      const updated = await settingsService.updateVerificationPolicy({ [option.key]: value });
      setPolicy(updated);
      publishPolicy(updated);
      feedback.success(value ? `${option.label}: activado` : `${option.label}: desactivado`, value ? option.on : option.off);
    } catch (e) {
      setPolicy(previous);
      void feedback.fromError(e, { title: 'No se pudo guardar' });
    } finally {
      setSaving(null);
    }
  };

  const saveConfidence = async (value: number) => {
    if (!policy) return;
    const previous = policy;
    setPolicy({ ...policy, min_confidence: value }); // optimista
    setSaving('min_confidence');
    try {
      const updated = await settingsService.updateVerificationPolicy({ min_confidence: value });
      setPolicy(updated);
      publishPolicy(updated);
      feedback.success('Nivel de confianza actualizado', `Se exigirá ${formatConfidence(value)} en cada verificación facial.`);
    } catch (e) {
      setPolicy(previous);
      void feedback.fromError(e, { title: 'No se pudo guardar' });
    } finally {
      setSaving(null);
    }
  };

  const onToggle = (option: Option, value: boolean) => {
    if (option.security && !value) setConfirm(option);
    else void save(option, value);
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Configuración" subtitle="Política de verificación de identidad de tu empresa" />
        {Boolean(error) && !policy && (
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        )}
        {!policy && !error && (
          <PanelSection>
            <SkeletonRows rows={6} />
          </PanelSection>
        )}
        {policy && (
          <PanelSection title="Nivel de confianza" icon={<Gauge size={20} />}>
            <p className="muted small">
              Probabilidad mínima de que la persona frente a la cámara sea el empleado registrado. Cada verificación
              informa su confianza y queda en el historial del empleado.
            </p>
            <ConfidenceSlider value={policy.min_confidence} busy={saving === 'min_confidence'} onSave={(v) => void saveConfidence(v)} />
          </PanelSection>
        )}
        {policy &&
          SECTIONS.map((section) => (
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
      </Panel>
      <ConfirmDialog
        open={confirm !== null}
        title={`Desactivar ${confirm?.label.toLowerCase() ?? ''}`}
        message={confirm?.confirmMessage ?? SPOOFING_WARNING}
        confirmLabel="Desactivar"
        tone="danger"
        onConfirm={() => {
          if (confirm) void save(confirm, false);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
