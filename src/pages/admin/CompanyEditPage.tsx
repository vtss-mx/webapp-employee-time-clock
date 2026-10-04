import { Building2, Save } from 'lucide-react';
import { useLayoutEffect, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyDataFields } from '../../components/CompanyForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { COMPANY_LABELS, emptyCompanyForm, useCompanyForm } from '../../hooks/useCompanyForm';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyDetail, CompanyFormValues } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeChanges } from '../../utils/changes';

const EDITABLE = ['name', 'legal_name', 'rfc', 'phone', 'max_employees'] as const;

function toForm(company: CompanyDetail): CompanyFormValues {
  return {
    ...emptyCompanyForm,
    name: company.name,
    legal_name: company.legal_name ?? '',
    rfc: company.rfc ?? '',
    phone: company.phone ?? '',
    max_employees: company.max_employees ? String(company.max_employees) : '',
  };
}

/** Confirmación de la edición: "antes → después" de cada dato que cambió (sin cambios, se avisa y no se envía nada). */
function editConfirm(company: CompanyDetail, values: CompanyFormValues): ConfirmInput {
  return {
    kind: 'edit',
    icon: <Building2 size={30} />,
    title: `¿Guardar los cambios de ${company.name}?`,
    message: 'Los datos se actualizan de inmediato en su ficha y en la consola de la empresa.',
    changes: describeChanges(toForm(company), values, COMPANY_LABELS),
    confirmLabel: 'Guardar cambios',
    confirmIcon: <Save size={18} />,
  };
}

/** Edición de los datos de la empresa (solo se envía lo que cambió). */
export function CompanyEditPage() {
  const companyId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: original, error: loadError, retry: load } = useResource((signal) => adminService.get(companyId, signal), companyId, 'No se pudo cargar la empresa');
  const form = useCompanyForm({ withAdmin: false, excludeId: companyId, originalRfc: original?.rfc ?? undefined });
  const { loadValues } = form;
  // Los campos se llenan con la empresa en cuanto llega (antes de pintarse: sin parpadeo de campos vacíos).
  useLayoutEffect(() => {
    if (original) loadValues(toForm(original));
  }, [original, loadValues]);

  const initial = original ? toForm(original) : null;
  const changes = Object.fromEntries(EDITABLE.filter((f) => initial && form.values[f].trim() !== initial[f]).map((f) => [f, form.values[f]]));
  const dirty = Object.keys(changes).length > 0;

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    // Sin cambios (p. ej. Enter en un campo) la confirmación avisa "Sin cambios" y no envía nada.
    if (!form.canSubmit || !original) return;
    await form.save(
      async () => {
        await adminService.update(companyId, changes);
        void form.feedback.success('Cambios guardados');
        void navigate(paths.admin.company(companyId));
      },
      'No se pudo guardar',
      editConfirm(original, form.values),
    );
  };

  if (!original && !loadError) return <SkeletonCard lines={6} />;

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title="Editar empresa" subtitle={original?.name} backTo={paths.admin.company(companyId)} />
        <PanelSection title="Datos de la empresa" icon={<Building2 size={20} />}>
          {Boolean(loadError) && !original && <RetryState onRetry={load} />}
          {original && (
            <CompanyDataFields
              values={form.values}
              errors={form.errors}
              onChange={form.setValues}
              onTouch={form.touch}
              live={form.live}
              disabled={form.saving}
            />
          )}
        </PanelSection>
        {original && (
          <PanelFooter>
            <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={form.saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={form.saving}
              disabled={!form.canSubmit || !dirty}
              title={!form.canSubmit ? 'Completa correctamente todos los campos obligatorios' : !dirty ? 'No hay cambios por guardar' : undefined}
              icon={<Save size={20} />}
            >
              Guardar cambios
            </Button>
          </PanelFooter>
        )}
      </Panel>
    </div>
  );
}
