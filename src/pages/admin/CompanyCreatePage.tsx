import { Building2, Plus, UserCog } from 'lucide-react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminFields, CompanyDataFields } from '../../components/CompanyForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useCompanyForm } from '../../hooks/useCompanyForm';
import { paths } from '../../routes/paths';
import { config } from '../../utils/config';
import { adminService } from '../../services/adminService';

/** Alta de empresa con su primer administrador (cuenta con la que la empresa entra a la plataforma). */
export function CompanyCreatePage() {
  const navigate = useNavigate();
  const form = useCompanyForm({ withAdmin: true });
  const fieldProps = { values: form.values, errors: form.errors, onChange: form.setValues, onTouch: form.touch, live: form.live, disabled: form.saving };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.canSubmit) return;
    await form.save(async () => {
      const company = await adminService.create(form.values);
      void navigate(paths.admin.company(company.id), { replace: true });
      void form.feedback.show({
        variant: 'success',
        title: 'Empresa registrada',
        text: `${company.name} ya puede usar ${config.appName}.`,
        details: [
          `Su administrador inicia sesión con ${company.admins[0]?.email ?? 'el correo capturado'}.`,
          'La política de verificación se creó con los valores más seguros; la empresa puede ajustarla.',
          'Desde aquí puedes agregar más administradores, editar sus datos o desactivarla.',
        ],
        detailsStyle: 'checks',
      });
    }, 'No se pudo registrar la empresa');
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title="Registrar empresa" backTo={paths.admin.companies} backLabel="Empresas" />
        <PanelSection title="Datos de la empresa" icon={<Building2 size={20} />}>
          <CompanyDataFields {...fieldProps} />
        </PanelSection>
        <PanelSection title="Administrador de la empresa" icon={<UserCog size={20} />}>
          <CompanyAdminFields {...fieldProps} />
        </PanelSection>
        <PanelFooter>
          <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={form.saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={form.saving}
            disabled={!form.canSubmit}
            title={form.canSubmit ? undefined : 'Completa correctamente todos los campos obligatorios'}
            icon={<Plus size={20} />}
          >
            Registrar empresa
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
