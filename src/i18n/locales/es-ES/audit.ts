import { derive } from '../../derive';
import es from '../es-MX/audit';

/**
 * Historial de auditoría en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3:
 * «bitácora» es «historial»).
 */
export default derive(es, {
  title: 'Historial de auditoría',
  loadError: 'No se pudo cargar el historial',
  exportAsk: {
    eyebrow: 'Historial de auditoría',
    title: '¿Exportar el historial del periodo?',
    note: 'La exportación queda registrada en el historial, con su filtro.',
  },
  exported: 'Historial exportado',
  exportError: 'No se pudo exportar el historial',
});
