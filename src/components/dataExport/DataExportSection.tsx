import { Download, EyeOff, FileDown, Timer } from 'lucide-react';
import { useT } from '../../i18n';
import type { DataExport } from '../../types/dataExport';
import { deliveredText, nextExportText, retentionRows, sectionName, sectionSummary, truncatedSections, withheldReasonText } from '../../utils/dataExport';
import { formatDateTime } from '../../utils/format';
import { formatList } from '../../utils/numbers';
import { Button } from '../ui/Button';
import { PanelSection } from '../ui/Panel';
import { useDataExport, type ExportSubject } from './useDataExport';

/**
 * Lo que NO se entregó, con su motivo. **Nunca se omite**: el art. 15.4 del RGPD permite retener lo que afecta a
 * otras personas o a la seguridad del tratamiento, pero exige DECIRLO. Cada línea lleva el nombre técnico de la
 * tabla (lo que un regulador pediría) y el motivo en el idioma de la persona.
 */
function Withheld({ data }: { data: DataExport }) {
  const t = useT();
  if (data.withheld.length === 0) return null;
  return (
    <div className="stack">
      <h4 className="inline-note small">
        <EyeOff size={16} /> {t('dataExport.withheldTitle')}
      </h4>
      <p className="muted small">{t('dataExport.withheldIntro')}</p>
      <dl className="details">
        {data.withheld.map((item) => (
          <div key={item.source}>
            <dt>
              <code>{item.source}</code>
            </dt>
            <dd>{withheldReasonText(item)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** El acuse de la entrega: lo que llevó cada sección, lo retenido, los plazos y cuándo se podrá pedir de nuevo. */
function Receipt({ data }: { data: DataExport }) {
  const t = useT();
  const cut = truncatedSections(data);
  return (
    <div className="stack">
      <p className="muted small">
        {t('dataExport.generatedAt', { date: formatDateTime(data.generated_at) })} · {deliveredText(data)}
      </p>
      {cut.length > 0 && <p className="muted small">{t('dataExport.truncatedList', { sections: formatList(cut) })}</p>}
      <dl className="details">
        {data.sections.map((section) => (
          <div key={section.name}>
            <dt>{sectionName(section)}</dt>
            <dd>{sectionSummary(section)}</dd>
          </div>
        ))}
      </dl>
      <Withheld data={data} />
      <div className="stack">
        <h4 className="inline-note small">
          <Timer size={16} /> {t('dataExport.retentionTitle')}
        </h4>
        <dl className="details">
          {retentionRows(data).map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="muted small">{nextExportText(data)}</p>
    </div>
  );
}

/**
 * «Mis datos» / «Datos del empleado»: pedir TODO lo que la plataforma guarda de una persona en esta empresa (RGPD
 * arts. 15 y 20, derechos ARCO, CCPA; migración 0097 del backend). Una sola implementación para «Mi perfil» (el
 * titular) y para el expediente del empleado (su empresa, que es quien responde por escrito).
 *
 * Confirma qué se entrega ANTES de pedirlo, descarga el JSON y deja el acuse en la pantalla: lo entregado, lo
 * RETENIDO con su motivo, los plazos de retención y cuándo se podrá pedir de nuevo.
 */
export function DataExportSection({ subject }: { subject: ExportSubject }) {
  const t = useT();
  const exporting = useDataExport(subject);
  const own = subject.kind === 'mine';
  return (
    <PanelSection title={t(own ? 'dataExport.titleMine' : 'dataExport.titleEmployee')} icon={<FileDown size={20} />}>
      <p className="muted small">{t(own ? 'dataExport.introMine' : 'dataExport.introEmployee')}</p>
      <p className="muted small">{t('dataExport.rights')}</p>
      <Button variant="secondary" block icon={<Download size={18} />} loading={exporting.busy} onClick={() => void exporting.run()}>
        {t(own ? 'dataExport.actionMine' : 'dataExport.actionEmployee')}
      </Button>
      {exporting.result && <Receipt data={exporting.result} />}
    </PanelSection>
  );
}
