import { t } from '../../i18n';
import type { ConfirmSource } from '../../types/confirm';

/** El motivo escrito se revisa en el mismo popup que los cambios; la traducción sigue al idioma activo. */
export function policyRiskConfirm(source: ConfirmSource | undefined, reason: string): ConfirmSource | undefined {
  if (!source || !reason.trim()) return source;
  return () => {
    const input = typeof source === 'function' ? source() : source;
    return { ...input, details: [...(input.details ?? []), { label: t('policy.risk.changeReason.label'), value: reason }] };
  };
}
