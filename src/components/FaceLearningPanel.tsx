import { BrainCircuit, ScanFace, Sparkles, Users } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { paths } from '../routes/paths';
import { employeeService } from '../services/employeeService';
import { timeAgo } from '../utils/format';
import { ButtonLink } from './ui/Button';
import { KpiGrid, type Kpi } from './ui/KpiCard';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

/**
 * Tablero de COMPANY: cómo evoluciona su reconocimiento facial. Cada identificación segura enseña a
 * la galería de cada empleado y lo que deja de servir se retira solo (lo decide el backend); aquí
 * solo se dibuja lo que reporta.
 */
export function FaceLearningPanel() {
  const { data, error, retry } = useResource((signal) => employeeService.faceLearning(signal), 'face-learning', 'No se pudo cargar la evolución del reconocimiento');

  const kpis: Kpi[] = [
    { key: 'employees', label: 'Empleados que ya aprenden', icon: Users, value: data?.employees_learning, tile: 'icon-tile--success' },
    { key: 'samples', label: 'Muestras aprendidas', icon: Sparkles, value: data?.learned_samples, tile: '' },
    { key: 'resolved', label: 'Identificaciones resueltas por lo aprendido', icon: ScanFace, value: data?.learned_identifications, tile: '' },
  ];
  const status = data && (
    <span className={`badge ${data.enabled ? 'badge--success' : 'badge--warning'}`}>{data.enabled ? 'Aprendiendo' : 'En pausa'}</span>
  );

  return (
    <PanelSection title="Reconocimiento facial evolutivo" icon={<BrainCircuit size={20} />} aside={status}>
      <p className="muted small">
        Cada identificación segura (con prueba de vida y confianza holgada) enseña al sistema cómo luce hoy cada empleado; lo
        aprendido que deja de servir se reemplaza solo. Las muestras que validaste nunca se reemplazan.
      </p>
      {Boolean(error) && !data ? (
        <RetryState onRetry={retry} />
      ) : (
        <KpiGrid kpis={kpis} />
      )}
      {data && (
        <p className="small muted">
          {data.last_learned_at
            ? `Último aprendizaje ${timeAgo(data.last_learned_at)} · ${data.employees_learning} de ${data.approved_employees} empleados con rostro aprobado.`
            : 'Aún no aprende: lo hará con las primeras identificaciones seguras de tus empleados.'}
        </p>
      )}
      {data && !data.enabled && (
        <div className="callout">
          <span className="icon-tile icon-tile--warning">
            <BrainCircuit size={22} />
          </span>
          <div className="callout__body">
            <strong>El aprendizaje continuo está en pausa</strong>
            <p className="muted small">Tus empleados se comparan solo con su registro aprobado. Actívalo para que el reconocimiento mejore con el uso.</p>
          </div>
          <ButtonLink to={paths.company.settings} variant="primary">
            Activar
          </ButtonLink>
        </div>
      )}
    </PanelSection>
  );
}
