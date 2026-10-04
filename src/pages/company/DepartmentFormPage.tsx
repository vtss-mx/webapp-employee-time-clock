import { Network, Plus, Save } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField, TextAreaField } from '../../components/FormField';
import { FormFooter } from '../../components/FormFooter';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { liveFeedback, useAvailability } from '../../hooks/useAvailability';
import { useFeedback } from '../../hooks/useFeedback';
import { useFormState } from '../../hooks/useFormState';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import { fieldErrorsFrom } from '../../services/http/envelope';
import type { Department } from '../../types';

interface DepartmentFormValues {
  name: string;
  description: string;
}

/** Regla del nombre (solo UX: el backend la vuelve a validar y exige que sea único). */
export function validateDepartmentName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'El nombre es obligatorio';
  return name.length > 100 ? 'El nombre admite hasta 100 caracteres' : undefined;
}

const serverErrors = (err: unknown) => fieldErrorsFrom<DepartmentFormValues>(err, { DEPARTMENT_NAME_TAKEN: 'name' });

/** Alta (/company/departments/new) o edición (/company/departments/:id/edit) de un departamento. */
export function DepartmentFormPage() {
  const { id } = useParams();
  const departmentId = id ? Number(id) : null;
  const { data: original, error, retry } = useResource(
    (signal) => (departmentId === null ? Promise.resolve(null) : departmentService.get(departmentId, signal)),
    departmentId ?? 'new',
    'No se pudo cargar el departamento',
  );

  if (departmentId === null) return <DepartmentForm original={null} />;
  if (!original) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Editar departamento" backTo={paths.company.departments} backLabel="Departamentos" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={4} />
    );
  }
  return <DepartmentForm key={original.id} original={original} />;
}

function DepartmentForm({ original }: { original: Department | null }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useFormState<DepartmentFormValues>({ name: original?.name ?? '', description: original?.description ?? '' }, { serverErrors });
  const { values } = form;
  const nameRule = validateDepartmentName(values.name);
  // Nombre único en la empresa, verificado en vivo (su propio nombre no cuenta al editar).
  const live = liveFeedback(useAvailability('department_name', values.name, { excludeId: original?.id, unchangedValue: original?.name, enabled: !nameRule }));
  const clientErrors = { name: nameRule ?? live.error, description: values.description.length > 500 ? 'La descripción admite hasta 500 caracteres' : undefined };
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(original ? paths.company.department(original.id) : paths.company.departments);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.touchAll();
    if (Object.values(clientErrors).some(Boolean)) {
      void form.feedback.invalidForm(clientErrors);
      return;
    }
    const payload = { name: values.name.trim(), description: values.description.trim() || null };
    void form.save(async () => {
      const saved = original ? await departmentService.update(original.id, payload) : await departmentService.create(payload);
      void feedback.success(original ? 'Departamento actualizado' : 'Departamento creado', original ? `${saved.name} quedó actualizado.` : `Ya puedes asignar a sus responsables y empleados.`);
      void navigate(paths.company.department(saved.id), { replace: !original });
    }, original ? 'No se pudo guardar el departamento' : 'No se pudo crear el departamento');
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={original ? 'Editar departamento' : 'Nuevo departamento'}
          subtitle={original?.name ?? 'Un área de tu empresa: Producción, Almacén, Recursos Humanos…'}
          backTo={original ? paths.company.department(original.id) : paths.company.departments}
          backLabel={original?.name ?? 'Departamentos'}
        />
        <PanelSection title="Datos del departamento" icon={<Network size={20} />}>
          <div className="stack">
            <FormField
              label="Nombre"
              icon={<Network size={18} />}
              required
              maxLength={100}
              disabled={form.saving}
              value={values.name}
              error={errors.name}
              status={live.status}
              hint="Único en tu empresa"
              onBlur={() => form.touch('name')}
              onChange={(e) => form.setValues({ ...values, name: e.target.value })}
            />
            <TextAreaField
              label="Descripción (opcional)"
              maxLength={500}
              disabled={form.saving}
              value={values.description}
              error={errors.description}
              placeholder="Para qué es el departamento o qué hace su equipo"
              onBlur={() => form.touch('description')}
              onChange={(description) => form.setValues({ ...values, description })}
            />
          </div>
        </PanelSection>
        <FormFooter
          submitLabel={original ? 'Guardar cambios' : 'Crear departamento'}
          submitIcon={original ? <Save size={20} /> : <Plus size={20} />}
          saving={form.saving}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
