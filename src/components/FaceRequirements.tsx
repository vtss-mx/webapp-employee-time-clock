import { ScanFace, Sun } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import type { VerificationRules } from '../types';
import { ruledAccessories } from './accessories';

interface FaceRequirementsProps {
  policy: Pick<VerificationRules, 'block_glasses' | 'block_headwear' | 'block_mask' | 'anti_spoofing'>;
  /** El empleado está exento de retirar prendas de cabeza (motivos religiosos o médicos). */
  headwearExempt?: boolean;
}

/** Recordatorio de lo que exige la empresa antes de la captura (según su política y el catálogo de accesorios). */
export function FaceRequirements({ policy, headwearExempt = false }: FaceRequirementsProps) {
  const { accessories } = useCatalogs();
  const removals = ruledAccessories(accessories)
    .filter(({ rule }) => policy[rule] && !(headwearExempt && rule === 'block_headwear'))
    .map(({ item, icon }) => ({ icon, text: `Sin ${item.name.toLowerCase()}` }));
  const items = [
    ...removals,
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
