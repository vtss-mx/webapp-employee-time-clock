import { ScanFace, Sun } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import { useT } from '../i18n';
import type { VerificationRules } from '../types';
import { ruledAccessories } from './accessories';

interface FaceRequirementsProps {
  policy: Pick<VerificationRules, 'block_glasses' | 'block_headwear' | 'block_mask' | 'anti_spoofing'>;
  /** El empleado está exento de retirar prendas de cabeza (motivos religiosos o médicos). */
  headwearExempt?: boolean;
}

/** Recordatorio de lo que exige la empresa antes de la captura (según su política y el catálogo de accesorios). */
export function FaceRequirements({ policy, headwearExempt = false }: FaceRequirementsProps) {
  const t = useT();
  const { accessories } = useCatalogs();
  // El nombre del accesorio viene del catálogo, ya en el idioma activo.
  const removals = ruledAccessories(accessories)
    .filter(({ rule }) => policy[rule] && !(headwearExempt && rule === 'block_headwear'))
    .map(({ item, icon }) => ({ icon, text: t('face.requirements.without', { name: item.name.toLowerCase() }) }));
  const items = [
    ...removals,
    { icon: Sun, text: t('face.requirements.lighting') },
    ...(policy.anti_spoofing ? [{ icon: ScanFace, text: t('face.requirements.realFace') }] : []),
  ];
  return (
    <ul className="requirements" aria-label={t('face.requirements.label')}>
      {items.map(({ icon: Icon, text }) => (
        <li key={text}>
          <Icon size={16} /> {text}
        </li>
      ))}
    </ul>
  );
}
