/** Textos que arman los servicios, los hooks y las utilidades del cliente (es-MX). */
export default {
  /** Verificación en vivo de datos únicos (`hooks/useAvailability.ts`); el resultado lo da el servidor. */
  availability: {
    checking: 'Verificando disponibilidad…',
  },
  /** Código QR dibujado en el navegador (`hooks/useQrImage.ts`). */
  qr: {
    loadFailed: 'No se pudo generar el código QR. Revisa tu conexión.',
  },
  /** Llave del dispositivo de un validador (`utils/deviceKey.ts`). */
  deviceKey: {
    unavailable: 'Este navegador no permite registrar el dispositivo. Usa Safari o Chrome actualizados, fuera del modo privado.',
  },
  /** Reporte de fallas de la app al ADMIN (`services/clientErrorService.ts`). */
  clientErrors: {
    noMessage: '(sin mensaje)',
  },
} as const;
