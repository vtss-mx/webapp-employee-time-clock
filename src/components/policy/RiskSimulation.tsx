import { FlaskConical, Play } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import { adminService } from '../../services/adminService';
import type { AdminVerificationPolicy, RiskPolicyCandidate, RiskSimulation, SimulationActions } from '../../types';
import { formatCount } from '../../utils/numbers';
import { Button } from '../ui/Button';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';

/** Las acciones del motor en el orden del resultado (de la más suave a la más estricta). */
const ACTIONS: Array<[keyof SimulationActions, string]> = [
  ['allow', 'ALLOW'],
  ['alert', 'ALERT'],
  ['step_up', 'STEP_UP'],
  ['review', 'REVIEW'],
  ['deny', 'DENY'],
];

type Tier = 'medium' | 'high' | 'critical';
const TIERS: Tier[] = ['medium', 'high', 'critical'];

const simulateError = () => t('policy.simulation.error');

interface SimulationSummaryProps {
  simulation: RiskSimulation;
  /** Nombres de las señales (los trae la política del ADMIN); una desconocida se muestra con su código. */
  signalName: (code: string) => string;
}

/**
 * Lo que habría pasado en los últimos días: cuántos intentos terminaron en cada acción hoy y con el cambio, cuántos
 * serían más estrictos o más suaves, los fraudes confirmados que se detendrían y las molestias a quien no hacía
 * fraude (la estimación de rechazos de más). Lo usan el panel de simulación y cada cambio del historial.
 */
export function SimulationSummary({ simulation, signalName }: SimulationSummaryProps) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (!simulation.evaluated) return <p className="muted small">{t('policy.simulation.empty', { days: simulation.days })}</p>;
  return (
    <div className="stack simulation">
      <p className="small muted">
        {t('policy.simulation.evaluated', { count: simulation.evaluated, days: simulation.days })}
        {simulation.capped && ` ${t('policy.simulation.capped')}`}
      </p>
      <table className="simulation__table">
        <thead>
          <tr>
            <th scope="col">{t('policy.simulation.action')}</th>
            <th scope="col">{t('policy.simulation.current')}</th>
            <th scope="col">{t('policy.simulation.candidate')}</th>
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map(([key, code]) => (
            <tr key={key}>
              <th scope="row">{nameOf('risk_actions', code)}</th>
              <td>{formatCount(simulation.current[key])}</td>
              <td>{formatCount(simulation.candidate[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="simulation__facts">
        <li>{t('policy.simulation.stricter', { count: simulation.stricter })}</li>
        <li>{t('policy.simulation.looser', { count: simulation.looser })}</li>
        <li>{t('policy.simulation.frauds', { stopped: simulation.frauds_stopped, count: simulation.frauds })}</li>
        <li className={simulation.genuine_affected ? 'text-warning' : undefined}>{t('policy.simulation.genuine', { count: simulation.genuine_affected })}</li>
      </ul>
      {simulation.top_reasons.length > 0 && (
        <p className="small">
          <strong>{t('policy.simulation.topReasons')}</strong>{' '}
          {simulation.top_reasons.map((reason) => t('policy.simulation.reason', { name: signalName(reason.code), times: formatCount(reason.count) })).join(' · ')}
        </p>
      )}
    </div>
  );
}

/** Los cortes y acciones que se quieren probar (texto de los campos numéricos tal como se escriben). */
type Candidate = Record<`${Tier}Score`, string> & Record<`${Tier}Action`, string>;

const candidateOf = (policy: AdminVerificationPolicy): Candidate => ({
  mediumScore: String(policy.risk_medium_score),
  highScore: String(policy.risk_high_score),
  criticalScore: String(policy.risk_critical_score),
  mediumAction: policy.risk_medium_action,
  highAction: policy.risk_high_action,
  criticalAction: policy.risk_critical_action,
});

/** Lo que se envía: solo lo que difiere de la política vigente (lo omitido queda como está). */
function payloadOf(candidate: Candidate, policy: AdminVerificationPolicy): RiskPolicyCandidate {
  const payload: RiskPolicyCandidate = { risk_engine: true };
  for (const tier of TIERS) {
    const score = Number(candidate[`${tier}Score`]);
    if (score !== policy[`risk_${tier}_score`]) payload[`risk_${tier}_score`] = score;
    if (candidate[`${tier}Action`] !== policy[`risk_${tier}_action`]) payload[`risk_${tier}_action`] = candidate[`${tier}Action`];
  }
  return payload;
}

/**
 * "¿Qué habría pasado?" (solo el ADMIN): vuelve a decidir los intentos guardados de los últimos días con otros
 * cortes y acciones, con las mismas reglas del motor. No guarda nada (no se confirma ni avisa: el resultado se ve
 * aquí); la falla sí se avisa con su popup.
 */
export function RiskSimulationPanel({ companyId, policy }: { companyId: number; policy: AdminVerificationPolicy }) {
  const t = useT();
  const { active } = useCatalogs();
  const [candidate, setCandidate] = useState(() => candidateOf(policy));
  const [result, setResult] = useState<RiskSimulation | null>(null);
  const { busy, run } = useAction();
  const signalName = (code: string) => policy.risk_signals.find((signal) => signal.code === code)?.name ?? code;
  const set = (key: keyof Candidate) => (value: string) => setCandidate((previous) => ({ ...previous, [key]: value }));
  const actions = active('risk_actions').map((action) => ({ value: action.code, label: action.name }));

  const simulate = () => void run(() => adminService.simulatePolicy(companyId, payloadOf(candidate, policy)), { errorTitle: simulateError, onSuccess: setResult });

  return (
    <div className="stack">
      <p className="muted small">{t('policy.simulation.hint')}</p>
      <div className="simulation__form">
        {TIERS.map((tier) => (
          <div key={tier} className="simulation__tier">
            <NumberField label={t(`policy.risk.fields.${tier}Score`)} value={candidate[`${tier}Score`]} onChange={set(`${tier}Score`)} min={1} max={100} step={5} size="sm" />
            <Select aria-label={t(`policy.risk.fields.${tier}Action`)} value={candidate[`${tier}Action`]} options={actions} onChange={set(`${tier}Action`)} size="sm" />
          </div>
        ))}
      </div>
      <div className="button-row">
        <Button variant="secondary" icon={<Play size={18} />} loading={busy !== null} onClick={simulate}>
          {t('policy.simulation.run')}
        </Button>
        <Button variant="ghost" icon={<FlaskConical size={18} />} disabled={busy !== null} onClick={() => setCandidate(candidateOf(policy))}>
          {t('policy.simulation.reset')}
        </Button>
      </div>
      {result && <SimulationSummary simulation={result} signalName={signalName} />}
    </div>
  );
}
