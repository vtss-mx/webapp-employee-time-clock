import { Blocks, Building2, KeyRound, Plus, UserCog } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminFields, CompanyDataFields } from '../../components/CompanyForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Switch } from '../../components/ui/Switch';
import { useCompanyForm } from '../../hooks/useCompanyForm';
import { paths } from '../../routes/paths';
import { config } from '../../utils/config';
import { adminService } from '../../services/adminService';

/** Alta de empresa con su primer administrador (cuenta con la que la empresa entra a la plataforma). */
export function CompanyCreatePage() {
  const navigate = useNavigate();
  const form = useCompanyForm({ withAdmin: true });
  // Integraciones (API) es un módulo que el ADMIN concede: por omisión la empresa no lo tiene.
  const [apiEnabled, setApiEnabled] = useState(false);
  const fieldProps = { values: form.values, errors: form.errors, onChange: form.setValues, onTouch: form.touch, live: form.live, disabled: form.saving };

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.canSubmit) return;
    await form.save(async () => {
      const company = await adminService.create(form.values, apiEnabled);
      void navigate(paths.admin.company(company.id), { replace: true });
      void form.feedback.show({
        variant: 'success',
        title: 'Empresa registrada',
        text: `${company.name} ya puede usar ${config.appName}.`,
        details: [
          `Su administrador inicia sesión con ${form.values.admin_email.trim().toLowerCase()}.`,
          'La política de verificación se creó con los valores más seguros; la empresa puede ajustarla.',
          company.api_enabled ? 'Tiene acceso a Integraciones (API): puede crear sus llaves.' : 'Sin acceso a Integraciones (API); puedes dárselo desde su ficha.',
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
        <PanelSection title="Módulos" icon={<Blocks size={20} />}>
          <Switch
            checked={apiEnabled}
            onChange={setApiEnabled}
            icon={<KeyRound size={20} />}
            label="Integraciones (API)"
            description="Permite que la empresa cree llaves para conectar sus sistemas (nómina, ERP). Puedes cambiarlo después."
            disabled={form.saving}
          />
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
