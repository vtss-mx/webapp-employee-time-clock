import { RefreshCw, Tablet } from 'lucide-react';
import { useQrImage } from '../../hooks/useQrImage';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { KioskCreated } from '../../types';
import { formatDateTime } from '../../utils/format';
import type { MessageInput } from '../MessageDialog';
import { Button } from '../ui/Button';
import { CopyField } from '../ui/CopyField';
import { Skeleton } from '../ui/Skeleton';

/**
 * Dirección que vincula la tableta: el código va en el FRAGMENTO (`#pair=`), que el navegador nunca envía a un
 * servidor; la pantalla del kiosco lo lee y lo borra de la barra de direcciones.
 */
export const kioskPairingUrl = (code: string) => `${window.location.origin}${paths.kiosk}#pair=${encodeURIComponent(code)}`;

/** El QR de la dirección, el código y la dirección para copiar, y hasta cuándo sirve. */
function PairingBody({ created }: { created: KioskCreated }) {
  const t = useT();
  const url = kioskPairingUrl(created.pairing_code);
  const qr = useQrImage(url, { width: 360 });
  return (
    <div className="kiosk-pairing">
      <div className="kiosk-pairing__qr">
        {qr.src ? (
          <img src={qr.src} alt={t('kiosk.pairing.qrAlt')} />
        ) : qr.error ? (
          <Button size="sm" variant="secondary" icon={<RefreshCw size={16} />} onClick={qr.retry}>
            {t('kiosk.pairing.qrRetry')}
          </Button>
        ) : (
          <Skeleton width="100%" height="100%" radius={12} />
        )}
      </div>
      <div className="kiosk-pairing__codes">
        <span className="small muted">{t('kiosk.pairing.code')}</span>
        <CopyField value={created.pairing_code} label={t('kiosk.pairing.copyCode')} />
        <span className="small muted">{t('kiosk.pairing.link')}</span>
        <CopyField value={url} label={t('kiosk.pairing.copyLink')} />
        <span className="small muted">{t('kiosk.pairing.expires', { date: formatDateTime(created.pairing_expires_at) })}</span>
      </div>
    </div>
  );
}

/**
 * Popup con el código de vinculación de un kiosco recién creado (o con un código nuevo). Es la ÚNICA vez que se ve
 * (en la BD solo queda su huella), así que solo se cierra confirmando que ya se usó o se guardó, como el secreto de una
 * llave de la API. Se pasa como función (`feedback.show(() => kioskPairingMessage(…))`): sigue al idioma activo.
 */
export function kioskPairingMessage(created: KioskCreated, renewed = false): MessageInput {
  return {
    variant: 'success',
    icon: <Tablet size={30} />,
    eyebrow: t(renewed ? 'kiosk.pairing.renewed' : 'kiosk.pairing.created'),
    title: t('kiosk.pairing.title', { name: created.kiosk.name }),
    text: t('kiosk.pairing.text'),
    body: <PairingBody created={created} />,
    details: [t('kiosk.pairing.once'), t('kiosk.pairing.single'), t('kiosk.pairing.lost')],
    detailsStyle: 'checks',
    actions: [{ id: 'saved', label: t('kiosk.pairing.saved'), variant: 'primary' }],
    dismissible: false,
    wide: true,
    key: `kiosk-pairing-${created.kiosk.id}`,
  };
}
