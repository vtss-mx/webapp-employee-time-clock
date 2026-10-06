/** Sitio de DB-IP: su licencia CC BY 4.0 pide el enlace junto a los datos que se muestran. */
const DB_IP_URL = 'https://db-ip.com';

/**
 * Atribución de la base local de IP (DB-IP Lite, CC BY 4.0; decisión D8): va donde se muestran sus datos (país y red
 * de un intento). Es el nombre del proveedor: se escribe igual en todo idioma.
 */
export function DbIpCredit() {
  return (
    <a href={DB_IP_URL} target="_blank" rel="noreferrer">
      IP Geolocation by DB-IP
    </a>
  );
}
