import { Ban, Glasses, HardHat, ScanFace, Sun } from 'lucide-react';
import type { VerificationPolicy } from '../types';

interface FaceRequirementsProps {
  policy: Pick<VerificationPolicy, 'block_glasses' | 'block_headwear' | 'block_mask' | 'anti_spoofing'>;
  /** El empleado está exento de retirar prendas de cabeza (motivos religiosos o médicos). */
  headwearExempt?: boolean;
}

/** Recordatorio de lo que exige la empresa antes de la captura (según su política). */
export function FaceRequirements({ policy, headwearExempt = false }: FaceRequirementsProps) {
  const items = [
    ...(policy.block_glasses ? [{ icon: Glasses, text: 'Sin lentes' }] : []),
    ...(policy.block_headwear && !headwearExempt ? [{ icon: HardHat, text: 'Sin gorra ni sombrero' }] : []),
    ...(policy.block_mask ? [{ icon: Ban, text: 'Sin cubrebocas' }] : []),
    { icon: Sun, text: 'Buena iluminación' },
    ...(policy.anti_spoofing ? [{ icon: ScanFace, text: 'Tu rostro real, sin fotos' }] : []),
  ];
  return (
    <ul className="requirements" aria-label="Requisitos para la captura">
      {items.map(({ icon: Icon, text }) => (
        <li key={text}>
          <Icon size={16} /> {text}
        </li>
      ))}
    </ul>
  );
}
