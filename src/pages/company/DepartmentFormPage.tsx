import { Network, Plus, Save } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField, TextAreaField } from '../../components/FormField';
import { FormFooter } from '../../components/FormFooter';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { ResourceFallback } from '../../components/ui/ResourceFallback';
import { liveFeedback, useAvailability } from '../../hooks/useAvailability';
import { useFeedback } from '../../hooks/useFeedback';
import { useFormState } from '../../hooks/useFormState';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import { fieldErrorsFrom } from '../../services/http/envelope';
import type { Department } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';

interface DepartmentFormValues {
  name: string;
  description: string;
}

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

/** Cómo se leen los campos en la confirmación (en este orden y en el idioma activo). */
const departmentLabels = (): FieldLabels<DepartmentFormValues> => ({ name: t('common.fields.name'), description: t('departments.form.description') });

/**
 * Antes de guardar: en el alta, qué se creará; en la edición, qué cambia ("antes → después"). Una
 * edición sin cambios no pregunta: avisa "Sin cambios" y no envía nada.
 */
function saveConfirm(original: Department | null, initial: DepartmentFormValues, values: DepartmentFormValues): ConfirmInput {
  if (!original) {
    return {
      kind: 'create',
      icon: <Network size={30} />,
      title: t('departments.form.createConfirm.title', { name: values.name.trim() }),
      message: t('departments.form.createConfirm.message'),
      detailsTitle: t('departments.form.createConfirm.detailsTitle'),
      details: describeValues(values, departmentLabels()),
      confirmLabel: t('departments.form.submit'),
    };
  }
  return {
    kind: 'edit',
    title: t('departments.form.editConfirm.title', { name: original.name }),
    message: t('departments.form.editConfirm.message'),
    changes: describeChanges(initial, values, departmentLabels()),
  };
}

/** Regla del nombre (solo UX: el backend la vuelve a validar y exige que sea único). */
export function validateDepartmentName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return t('departments.form.nameRequired');
  return name.length > NAME_MAX ? t('departments.form.nameTooLong', { max: NAME_MAX }) : undefined;
}

const descriptionTooLong = () => t('departments.form.descriptionTooLong', { max: DESCRIPTION_MAX });
const loadError = () => t('departments.loadError');
const saveError = (original: Department | null) => () => t(original ? 'departments.form.saveError' : 'departments.form.createError');

/** El aviso al guardar: solo el título al editar; al dar de alta, además qué sigue. Se arma al dibujarse. */
const savedTitle = (editing: boolean) => () => t(editing ? 'departments.form.updated' : 'departments.form.created');
const savedText = (editing: boolean) => (editing ? undefined : () => t('departments.form.createdText'));

const serverErrors = (err: unknown) => fieldErrorsFrom<DepartmentFormValues>(err, { DEPARTMENT_NAME_TAKEN: 'name' });

/** Alta (/company/departments/new) o edición (/company/departments/:id/edit) de un departamento. */
export function DepartmentFormPage() {
  const t = useT();
  const { id } = useParams();
  const departmentId = id ? Number(id) : null;
  const { data: original, error, retry } = useResource(
    (signal) => (departmentId === null ? Promise.resolve(null) : departmentService.get(departmentId, signal)),
    departmentId ?? 'new',
    loadError,
  );

  if (departmentId === null) return <DepartmentForm original={null} />;
  if (!original) {
    return <ResourceFallback error={error} retry={retry} lines={4} header={{ title: t('departments.form.editTitle'), backTo: paths.company.departments, backLabel: t('departments.back') }} />;
  }
  return <DepartmentForm key={original.id} original={original} />;
}

function DepartmentForm({ original }: { original: Department | null }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const initial: DepartmentFormValues = { name: original?.name ?? '', description: original?.description ?? '' };
  const form = useFormState<DepartmentFormValues>(initial, { serverErrors });
  const { values } = form;
  const nameRule = validateDepartmentName(values.name);
  // Nombre único en la empresa, verificado en vivo (su propio nombre no cuenta al editar).
  const live = liveFeedback(useAvailability('department_name', values.name, { excludeId: original?.id, unchangedValue: original?.name, enabled: !nameRule }));
  // Como función: el resumen de "Revisa la información" abierto sigue al idioma activo.
  const validate = () => ({ name: validateDepartmentName(values.name) ?? live.error, description: values.description.length > DESCRIPTION_MAX ? descriptionTooLong() : undefined });
  const clientErrors = validate();
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(original ? paths.company.department(original.id) : paths.company.departments);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.touchAll();
    if (Object.values(clientErrors).some(Boolean)) {
      void form.feedback.invalidForm(validate);
      return;
    }
    const payload = { name: values.name.trim(), description: values.description.trim() || null };
    void form.save(async () => {
      const saved = original ? await departmentService.update(original.id, payload) : await departmentService.create(payload);
      void feedback.success(savedTitle(original !== null), savedText(original !== null));
      void navigate(paths.company.department(saved.id), { replace: !original });
    }, saveError(original), () => saveConfirm(original, initial, values));
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={t(original ? 'departments.form.editTitle' : 'departments.form.newTitle')}
          subtitle={original?.name ?? t('departments.form.newSubtitle')}
          backTo={original ? paths.company.department(original.id) : paths.company.departments}
          backLabel={original?.name ?? t('departments.back')}
        />
        <PanelSection title={t('departments.form.section')} icon={<Network size={20} />}>
          <div className="stack">
            <FormField
              label={t('common.fields.name')}
              icon={<Network size={18} />}
              required
              maxLength={NAME_MAX}
              disabled={form.saving}
              value={values.name}
              error={errors.name}
              status={live.status}
              hint={t('departments.form.nameHint')}
              onBlur={() => form.touch('name')}
              onChange={(e) => form.setValues({ ...values, name: e.target.value })}
            />
            <TextAreaField
              label={t('departments.form.descriptionLabel')}
              maxLength={DESCRIPTION_MAX}
              disabled={form.saving}
              value={values.description}
              error={errors.description}
              placeholder={t('departments.form.descriptionPlaceholder')}
              onBlur={() => form.touch('description')}
              onChange={(description) => form.setValues({ ...values, description })}
            />
          </div>
        </PanelSection>
        <FormFooter
          submitLabel={t(original ? 'common.actions.saveChanges' : 'departments.form.submit')}
          submitIcon={original ? <Save size={20} /> : <Plus size={20} />}
          saving={form.saving}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
