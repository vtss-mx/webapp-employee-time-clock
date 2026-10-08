import { useT } from '../../i18n';

/** Sitio de DB-IP: su licencia CC BY 4.0 pide el enlace junto a los datos que se muestran. */
const DB_IP_URL = 'https://db-ip.com';

/**
 * Atribución de la base local de IP (DB-IP Lite, CC BY 4.0; decisión D8): va donde se muestran sus datos (país y red
 * de un intento). La licencia pide nombrar al proveedor con su enlace, no una frase fija: va en el idioma activo
 * («Geolocalización de IP por DB-IP» · "IP Geolocation by DB-IP"); DB-IP es el nombre propio (regla 16).
 */
export function DbIpCredit() {
  const t = useT();
  return (
    <a href={DB_IP_URL} target="_blank" rel="noreferrer">
      {t('fraud.attempts.dbIpCredit')}
    </a>
  );
}
