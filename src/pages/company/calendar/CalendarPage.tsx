import { BriefcaseBusiness, CalendarHeart, Inbox, Plane } from 'lucide-react';
import { useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AbsencesTab } from '../../../components/calendar/AbsencesTab';
import { tabFrom, type CalendarTab } from '../../../components/calendar/calendarRules';
import { HolidaysTab } from '../../../components/calendar/HolidaysTab';
import { RequestsTab } from '../../../components/calendar/RequestsTab';
import { WorkdaysTab } from '../../../components/calendar/WorkdaysTab';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { TabPanel, Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useResource } from '../../../hooks/useResource';
import { calendarService } from '../../../services/calendarService';

/**
 * Calendario (COMPANY): qué días se trabaja y cuáles no. Pestañas en la URL (`?tab=`, se puede
 * compartir y sobrevive a recargar): días festivos (con los oficiales de un botón), ausencias de uno o
 * varios empleados, las solicitudes de vacaciones o permisos por decidir (con su contador) y los días
 * laborables especiales por persona.
 */
export function CalendarPage() {
  const idBase = useId();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  // Contador de la pestaña "Solicitudes": una consulta al abrir; la pestaña lo actualiza al cargar.
  const pending = useResource((signal) => calendarService.pendingAbsences(signal), 'pending-absences', 'No se pudieron contar las solicitudes pendientes');

  const tabs: Array<TabItem<CalendarTab>> = [
    { key: 'holidays', label: 'Días festivos', icon: <CalendarHeart size={16} /> },
    { key: 'absences', label: 'Ausencias', icon: <Plane size={16} /> },
    { key: 'requests', label: 'Solicitudes', icon: <Inbox size={16} />, count: pending.data, countLabel: 'por decidir' },
    { key: 'workdays', label: 'Días laborables', icon: <BriefcaseBusiness size={16} /> },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Calendario" subtitle="Días festivos, vacaciones, permisos y excepciones: qué días tiene que checar cada persona." />
        <PanelSection>
          <Tabs items={tabs} value={tab} onChange={(next) => setParams(next === 'holidays' ? {} : { tab: next }, { replace: true })} label="Secciones del calendario" idBase={idBase} className="cal-tabs" />
          <TabPanel idBase={idBase} tab={tab}>
            {tab === 'holidays' && <HolidaysTab />}
            {tab === 'absences' && <AbsencesTab onChanged={pending.retry} />}
            {tab === 'requests' && <RequestsTab onTotal={pending.setData} />}
            {tab === 'workdays' && <WorkdaysTab />}
          </TabPanel>
        </PanelSection>
      </Panel>
    </div>
  );
}
