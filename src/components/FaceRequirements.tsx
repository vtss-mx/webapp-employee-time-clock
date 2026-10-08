import { ScanFace, Sun } from 'lucide-react';
import { useT } from '../i18n';
import type { VerificationRules } from '../types';

interface FaceRequirementsProps {
  policy: Pick<VerificationRules, 'anti_spoofing'>;
}

/**
 * Recordatorio antes de la captura: buena luz y el rostro real. Nunca pide retirar un accesorio (decisión del dueño,
 * 2026-10-07: los lentes se permiten y el cubrebocas o la gorra, si la empresa los exige, los explica el servidor al
 * validar la foto inicial; la experiencia no los anuncia).
 */
export function FaceRequirements({ policy }: FaceRequirementsProps) {
  const t = useT();
  const items = [{ icon: Sun, text: t('face.requirements.lighting') }, ...(policy.anti_spoofing ? [{ icon: ScanFace, text: t('face.requirements.realFace') }] : [])];
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
