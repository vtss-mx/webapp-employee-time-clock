import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VerificationDetailView } from '../../components/verifications/VerificationParts';
import { Button } from '../../components/ui/Button';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ResourceFallback } from '../../components/ui/ResourceFallback';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminVerificationsService, verificationsService } from '../../services/verificationsService';
import type { VerificationDetail } from '../../types';

const loadError = () => t('verification.detail.loadError');

/**
 * El detalle de una verificación: UNA pantalla para los dos roles (regla 6), con el servicio y la ruta de regreso
 * de cada uno. El ADMIN la abre desde el historial de todas las empresas y la empresa desde el suyo; el servidor
 * decide qué alcance tiene cada quien (un id de otra empresa responde 404, igual que lo que no existe).
 *
 * Solo consulta: una verificación es evidencia y no se edita ni se borra. **Sin un solo dato biométrico**
 * (regla 13): números, códigos y veredictos, más la foto de PERFIL de la persona.
 */
function DetailPage({ load, backTo, backLabel, caseLink }: { load: (id: number, signal: AbortSignal) => Promise<VerificationDetail>; backTo: string; backLabel: string; caseLink?: (caseId: number) => ReactNode }) {
  const t = useT();
  const id = Number(useParams().id);
  const { data, error, retry } = useResource((signal) => load(id, signal), id, loadError);
  const header = { title: t('verification.detail.title', { id }), backTo, backLabel };
  if (!data) return <ResourceFallback error={error} retry={retry} lines={8} header={header} />;
  return (
    <div className="page">
      <Panel>
        <PanelHeader {...header} subtitle={t('verification.detail.subtitle')} />
        <VerificationDetailView detail={data} caseLink={caseLink} />
      </Panel>
    </div>
  );
}

/** El detalle que ve el ADMIN (de cualquier empresa), con el enlace al caso de fraude que el intento abrió. */
export function AdminVerificationDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <DetailPage
      load={(id, signal) => adminVerificationsService.detail(id, signal)}
      backTo={paths.admin.verifications}
      backLabel={t('verification.admin.title')}
      caseLink={(caseId) => (
        <Button variant="secondary" icon={<ShieldAlert size={18} />} onClick={() => void navigate(paths.admin.fraudCase(caseId))}>
          {t('verification.detail.openCase')}
        </Button>
      )}
    />
  );
}

/** El detalle que ve la empresa (solo de la suya): el mismo, sin el enlace al caso (esa pantalla es del ADMIN). */
export function CompanyVerificationDetailPage() {
  const t = useT();
  return <DetailPage load={(id, signal) => verificationsService.detail(id, signal)} backTo={paths.company.verifications} backLabel={t('verification.company.title')} />;
}
