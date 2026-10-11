/**
 * Escáner de documento (`DocumentScanner`, es-MX): la captura con cámara del documento de identidad del empleado en
 * «Mis documentos» → «Subir documento». Un escáner en vivo con guía que toma la foto sola cuando el documento llena la
 * guía, está enfocado, con luz, sin reflejos, derecho y quieto; también un obturador manual. La foto va a la MISMA
 * subida que un archivo elegido y el servidor la lee con OCR. Las indicaciones son cortas, como las del escaneo facial.
 */
export default {
  title: 'Foto del documento',
  subtitle: 'Coloca el documento en la guía; la foto se toma sola.',
  /** Abre el escáner (en el formulario) y obturador manual dentro del escáner. */
  take: 'Tomar foto',
  cameraFallback: 'Si la cámara no abre, elige un archivo.',
  captureError: 'No se pudo tomar la foto',
  /** Base del nombre del archivo de la foto tomada. */
  fileName: 'documento',
  /** Indicación grande bajo la guía (sigue al estado del cuadro). */
  guide: {
    searching: 'Coloca el documento en la guía',
    tooFar: 'Acércate',
    tooDark: 'Más luz',
    tooBright: 'Evita la luz directa',
    glare: 'Evita los reflejos',
    straighten: 'Centra el documento',
    holdStill: 'Mantén firme',
    capturing: 'Capturando…',
  },
} as const;
