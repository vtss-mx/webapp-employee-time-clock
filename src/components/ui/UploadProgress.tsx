interface UploadProgressProps {
  /** Qué se envía: «Subiendo tu foto…», «Subiendo el documento…». */
  label: string;
  /** Sobre lo que se envía, al pie (la foto que se recorta); por omisión, en su lugar dentro del formulario. */
  overlay?: boolean;
}

/**
 * Avance de un envío que no informa su porcentaje (la foto de perfil, un documento): el texto y una barra que la
 * recorre, anunciado como estado. Una sola pieza para toda subida (estilos `.upload-progress` en `global.css`; sin
 * movimiento con "reducir movimiento").
 */
export function UploadProgress({ label, overlay = false }: UploadProgressProps) {
  return (
    <span className={overlay ? 'upload-progress upload-progress--overlay' : 'upload-progress'} role="status">
      <span className="upload-progress__bar" aria-hidden />
      {label}
    </span>
  );
}
