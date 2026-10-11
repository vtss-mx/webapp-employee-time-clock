import { CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { VerificationFilters, VerificationMethod, VerificationSummary } from '../../types';
import { DateField } from '../ui/DateField';
import { Select } from '../ui/Select';

/** Lo elegido en la barra de filtros. Son códigos y fechas, nunca textos traducidos (cambio de idioma en caliente). */
export interface VerificationChoice {
  result: 'all' | 'success' | 'failed';
  from: string;
  to: string;
  method: VerificationMethod | '';
  reason: string;
  risk: string;
  located: '' | 'yes' | 'no';
}

export const EMPTY_CHOICE: VerificationChoice = { result: 'all', from: '', to: '', method: '', reason: '', risk: '', located: '' };

/** ¿Hay algún filtro puesto? (el vacío de la lista lo dice de otra manera). */
export const isFiltered = (choice: VerificationChoice): boolean => JSON.stringify(choice) !== JSON.stringify(EMPTY_CHOICE);

/** Una llave estable de lo elegido: `usePagedList` vuelve a la primera página cuando cambia. */
export const choiceKey = (choice: VerificationChoice): string => Object.values(choice).join('|');

/** Lo elegido como filtros de la API (lo que no se eligió, simplemente no viaja). */
export function filtersOf(choice: VerificationChoice): VerificationFilters {
  return {
    start: choice.from || undefined,
    end: choice.to || undefined,
    success: choice.result === 'all' ? undefined : choice.result === 'success',
    method: choice.method || undefined,
    reason: choice.reason || undefined,
    risk_tier: choice.risk || undefined,
    located: choice.located === '' ? undefined : choice.located === 'yes',
  };
}

/**
 * Los filtros del historial de verificaciones, los MISMOS para el ADMIN y para la empresa (regla 6): resultado,
 * periodo, método, motivo de rechazo, nivel de riesgo y con o sin ubicación.
 *
 * Los valores de cada lista salen de su CATÁLOGO (`verification_methods`, `verification_reasons`, `risk_tiers`) y
 * los niveles que de verdad se pueden filtrar los publica el servidor en el resumen (`filterable_risk_tiers`): la
 * app no decide ni calcula ninguno (reglas 1 y 25). Mientras el resumen no llega, la lista de riesgo no se dibuja.
 */
export function VerificationToolbar({ choice, onChange, summary }: { choice: VerificationChoice; onChange: (next: VerificationChoice) => void; summary: VerificationSummary | null }) {
  const t = useT();
  const { active, nameOf } = useCatalogs();
  const set = <K extends keyof VerificationChoice>(key: K, value: VerificationChoice[K]) => onChange({ ...choice, [key]: value });
  const tabs: { key: VerificationChoice['result']; label: string; Icon: typeof CheckCircle2 }[] = [
    { key: 'all', label: t('verification.company.filters.all'), Icon: ListChecks },
    { key: 'success', label: t('verification.company.filters.success'), Icon: CheckCircle2 },
    { key: 'failed', label: t('verification.company.filters.failed'), Icon: XCircle },
  ];
  return (
    <>
      <div className="tabs" role="tablist" aria-label={t('verification.company.columns.result')}>
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} role="tab" type="button" aria-selected={choice.result === key} className={`tab ${choice.result === key ? 'is-active' : ''}`} onClick={() => set('result', key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <div className="verifications__filters">
        <DateField label={t('verification.company.filters.from')} value={choice.from} onChange={(value) => set('from', value)} max={choice.to || undefined} />
        <DateField label={t('verification.company.filters.to')} value={choice.to} onChange={(value) => set('to', value)} min={choice.from || undefined} />
        <Select<VerificationMethod | ''>
          value={choice.method}
          onChange={(value) => set('method', value)}
          aria-label={t('verification.company.columns.method')}
          options={[
            { value: '', label: t('verification.filters.anyMethod') },
            ...active('verification_methods').map((row) => ({ value: row.code, label: row.name })),
          ]}
        />
        <Select
          value={choice.reason}
          onChange={(value) => set('reason', value)}
          aria-label={t('verification.filters.reason')}
          options={[{ value: '', label: t('verification.filters.anyReason') }, ...active('verification_reasons').map((row) => ({ value: row.code, label: row.name }))]}
        />
        {summary && (
          <Select
            value={choice.risk}
            onChange={(value) => set('risk', value)}
            aria-label={t('verification.filters.risk')}
            options={[{ value: '', label: t('verification.filters.anyRisk') }, ...summary.filterable_risk_tiers.map((tier) => ({ value: tier, label: nameOf('risk_tiers', tier) }))]}
          />
        )}
        <Select<VerificationChoice['located']>
          value={choice.located}
          onChange={(value) => set('located', value)}
          aria-label={t('verification.company.columns.place')}
          options={[
            { value: '', label: t('verification.filters.anyPlace') },
            { value: 'yes', label: t('verification.filters.located') },
            { value: 'no', label: t('verification.filters.unlocated') },
          ]}
        />
      </div>
    </>
  );
}
