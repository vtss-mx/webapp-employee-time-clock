import { derive } from '../../derive';
import es from '../es-MX/auth';

/** Textos del inicio de sesión y de la cuenta en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  device: {
    pendingSteps: {
      ask: 'Pide a un administrador de tu empresa que entre en Validadores › Dispositivos.',
    },
  },
  deviceBlock: {
    eyebrow: 'Estás usando un ordenador',
  },
  companySelect: {
    enterFailed: 'No se pudo entrar en {company}',
  },
});
