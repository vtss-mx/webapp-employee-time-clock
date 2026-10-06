import { CheckCircle2, Layers } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import type { AdminVerificationPolicy, CatalogItem } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { Button } from '../ui/Button';

/**
 * Aplicar un nivel: qué fija (la descripción del catálogo), a quién aplica y, con la regla de dos personas, que
 * lo que relaje la seguridad esperará la aprobación de otro ADMIN.
 */
export function presetConfirm(preset: CatalogItem, company: string, twoPersonRule: boolean): ConfirmInput {
  return {
    kind: 'edit',
    tone: 'primary',
    icon: <Layers size={30} />,
    eyebrow: t('policy.presets.eyebrow'),
    title: t('policy.presets.confirmTitle', { name: preset.name }),
    message: preset.description ?? undefined,
    details: [{ label: t('policy.presets.company'), value: company }],
    note: twoPersonRule ? t('policy.presets.noteTwoPerson') : t('policy.presets.note'),
    confirmLabel: t('policy.presets.apply'),
    confirmIcon: <Layers size={18} />,
  };
}

interface PolicyPresetsProps {
  policy: AdminVerificationPolicy;
  /** Se está aplicando un nivel (los botones quedan ocupados). */
  busy: boolean;
  onApply: (preset: CatalogItem) => void;
}

/**
 * Niveles predefinidos de la política (Estándar, Alto, Máximo; catálogo `policy_presets`): cada uno con lo que
 * fija y "Aplicar". El vigente se marca; tras un ajuste a mano la política queda "a la medida".
 */
export function PolicyPresets({ policy, busy, onApply }: PolicyPresetsProps) {
  const t = useT();
  const { active, nameOf } = useCatalogs();
  return (
    <div className="stack">
      <p className="muted small">
        {t('policy.presets.current', { name: policy.preset ? nameOf('policy_presets', policy.preset) : t('policy.presets.custom') })}
      </p>
      <ul className="preset-list">
        {active('policy_presets').map((preset) => {
          const current = preset.code === policy.preset;
          return (
            <li key={preset.code} className={`preset-card ${current ? 'is-current' : ''}`}>
              <span className="preset-card__text">
                <strong>{preset.name}</strong>
                {preset.description && <span className="small muted">{preset.description}</span>}
              </span>
              {current ? (
                <span className="badge badge--success">
                  <CheckCircle2 size={14} /> {t('policy.presets.inForce')}
                </span>
              ) : (
                <Button variant="secondary" size="sm" icon={<Layers size={16} />} loading={busy} disabled={busy} onClick={() => onApply(preset)}>
                  {t('policy.presets.apply')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
