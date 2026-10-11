import { derive } from '../../derive';
import es from '../es-MX/location';

/**
 * Textos de domicilios, mapas y ubicación en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3). Los campos del domicilio usan los nombres de España, los mismos de los mensajes del
 * servidor («barrio» por «colonia», «provincia» por «estado», «municipio», «vía»; en México «departamento» es la
 * vivienda: aquí «piso, puerta»), y «localizar» por «ubicar».
 */
export default derive(es, {
  problems: {
    unavailable: {
      text: 'Activa la ubicación (GPS) e inténtalo de nuevo, preferiblemente cerca de una ventana.',
    },
    timeout: {
      text: 'Activa la ubicación precisa del dispositivo e inténtalo de nuevo.',
    },
  },
  deniedFor: {
    map: {
      text: 'Para localizarte en el mapa hace falta el permiso de ubicación y está bloqueado en este navegador.',
    },
    verification: {
      next: 'Vuelve aquí y toca «Reintentar».',
    },
  },
  address: {
    state: { label: 'Provincia', hint: 'Provincia o región del país.' },
    municipality: { label: 'Municipio' },
    neighborhood: { label: 'Barrio', hint: 'Barrio o zona dentro de la localidad.' },
    street: { label: 'Calle o vía' },
    interiorNumber: { hint: 'Piso, puerta, oficina o local dentro del inmueble. Es opcional.' },
    referenceNotes: {
      hint: 'Indicaciones adicionales para localizarlo, como calles o lugares cercanos. Son opcionales.',
      placeholder: 'Esquina con la calle Mayor, frente a la plaza',
    },
    required: {
      state: 'Escribe la provincia',
      municipality: 'Escribe el municipio',
      neighborhood: 'Escribe el barrio',
    },
  },
  picker: {
    notices: {
      offline: 'Google Maps no respondió. Revisa tu conexión e inténtalo de nuevo.',
    },
    locateError: 'No se pudo localizar el punto',
    notConfigured: 'El mapa no está configurado: el domicilio se escribe a mano y no se puede exigir ubicación.',
    locateWritten: 'Localizar la dirección escrita',
  },
});
