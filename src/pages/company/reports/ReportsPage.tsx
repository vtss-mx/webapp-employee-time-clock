import { Bookmark, SlidersHorizontal } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ReportAssistant } from '../../../components/reports/ReportAssistant';
import { ReportBuilder } from '../../../components/reports/ReportBuilder';
import { SavedReports } from '../../../components/reports/SavedReports';
import { Panel, PanelHero, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { useResource } from '../../../hooks/useResource';
import { reportService } from '../../../services/reportService';

/**
 * Reportes de la empresa: un asistente al que se le pregunta en español (sin inteligencia externa:
 * ningún dato sale del servidor), un constructor guiado y los reportes guardados. Todo consulta
 * solo los datos de esta empresa y se exporta a Excel.
 */
export function ReportsPage() {
  const { data: catalog, error, retry } = useResource((signal) => reportService.catalog(signal), 'report-catalog', 'No se pudo cargar el asistente de reportes');
  const [version, setVersion] = useState(0);
  const saved = useCallback(() => setVersion((current) => current + 1), []);

  let body = <SkeletonRows rows={3} />;
  if (catalog) body = <ReportAssistant suggestions={catalog.suggestions} onSaved={saved} />;
  else if (error) body = <RetryState onRetry={retry} />;

  return (
    <div className="page reports-page">
      <Panel>
        <PanelHero eyebrow="Asistente de reportes" title="Pregunta sobre los datos de tu empresa">
          <p className="muted">
            Respondo con los datos de tu empresa (nunca de otra), te digo lo que destaca y exporto cualquier respuesta a Excel. Aprendo de
            cómo preguntas.
          </p>
        </PanelHero>
        <PanelSection>{body}</PanelSection>
      </Panel>
      {catalog && (
        <Panel>
          <PanelSection title="Armar un reporte" icon={<SlidersHorizontal size={20} />}>
            <ReportBuilder catalog={catalog} onSaved={saved} />
          </PanelSection>
        </Panel>
      )}
      <Panel>
        <PanelSection title="Reportes guardados" icon={<Bookmark size={20} />}>
          <SavedReports version={version} />
        </PanelSection>
      </Panel>
    </div>
  );
}
