import { derive } from '../../derive';
import es from '../es-MX/face';

/**
 * Textos de la cámara, el registro y la verificación facial en español de España (es-ES): solo lo que cambia respecto de
 * es-MX (vocabulario; glosario §3): «icono», «portátil», «el Mac» (como lo nombra Apple en España), «entrar en».
 */
export default derive(es, {
  cameraHelp: {
    insecure: {
      useHttps: 'Entra en la aplicación con una dirección https://.',
    },
    site: {
      chrome: 'En la barra de direcciones haz clic en el icono de cámara o del candado → Cámara → "Permitir".',
      firefox: 'Haz clic en el icono de cámara tachada junto a la dirección y quita el bloqueo.',
      other: 'Abre los permisos del sitio (icono junto a la dirección) y permite la cámara.',
    },
    system: {
      macos: 'En el Mac: menú Apple → Ajustes del Sistema → Privacidad y seguridad → Cámara → activa {browser}. Después cierra y vuelve a abrir {browser}.',
    },
    notFound: {
      message: 'El sistema no informa de ninguna cámara disponible para el navegador.',
      antivirus:
        'Si tu equipo tiene antivirus o control corporativo (p. ej. Kaspersky → "Protección de cámara web"), puede estar bloqueando la cámara: desactívalo o añade tu navegador como excepción.',
      macCheck: 'Verifica que el Mac detecte la cámara: menú Apple → Acerca de este Mac → Más información → Informe del sistema → Cámara.',
      macNoBuiltIn:
        'En Mac mini, Mac Studio o un MacBook con la tapa cerrada no hay cámara integrada disponible: conecta una cámara USB o usa la cámara de Continuidad del iPhone.',
      windowsSwitch: 'Algunos portátiles tienen un interruptor o una tecla (F8, F10 o con icono de cámara) que la apaga.',
    },
    unknown: {
      message: 'Se ha producido un problema inesperado al abrir la cámara.',
    },
    inApp: {
      ios: 'Toca el menú (⋯ o el icono de compartir) y elige «Abrir en Safari» o «Abrir en el navegador».',
    },
  },
  flow: {
    retry: 'Inténtalo de nuevo',
  },
  confidence: {
    note: 'Se aplica en segundos a todas las verificaciones faciales de la empresa.',
  },
  learning: {
    intro:
      'Cada identificación segura (con prueba de vida y confianza holgada) enseña al sistema qué aspecto tiene hoy cada empleado; lo aprendido que deja de servir se reemplaza solo. Las muestras que validó la empresa nunca se reemplazan.',
    never: 'Aún no ha aprendido: lo hará con las primeras identificaciones seguras de sus empleados.',
  },
});
