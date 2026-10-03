import { RotateCcw, ScanFace } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';

/** COMPANY solicita al empleado verificar de nuevo su identidad, con un motivo que él verá. */
export function ReverifyIdentityPage() {
  const employeeId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: employee, error, retry } = useResource(() => employeeService.get(employeeId), employeeId, 'No se pudo cargar el empleado');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const back = () => void navigate(paths.company.employee(employeeId));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await employeeService.resetFace(employeeId, reason.trim() || undefined);
      void feedback.success('Verificación solicitada', `${updated.full_name} deberá registrar su rostro de nuevo en su próximo acceso.`);
      back();
    } catch (err) {
      setSaving(false);
      void feedback.fromError(err, { title: 'No se pudo solicitar la verificación' });
    }
  };

  if (!employee) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return (
    <ReasonFormPanel
      title="Solicitar nueva verificación de identidad"
      subtitle={employee.full_name}
      backTo={paths.company.employee(employeeId)}
      backLabel={employee.full_name}
      icon={<ScanFace size={20} />}
      intro={`Se eliminarán sus datos faciales actuales. En su próximo acceso, ${employee.first_name} deberá registrar su rostro con prueba de vida y tendrás que validarlo nuevamente. Mientras tanto no podrá identificarse.`}
      field={{
        catalog: 'reverification_reasons',
        label: 'Motivo (opcional, visible para el empleado)',
        placeholder: 'Si no escribes un motivo, se le indicará que la empresa solicitó verificar su identidad.',
      }}
      reason={reason}
      onReason={setReason}
      submit={{ label: 'Solicitar verificación', icon: <RotateCcw size={18} />, variant: 'warning' }}
      saving={saving}
      onSubmit={(e) => void submit(e)}
      onCancel={back}
    />
  );
}
