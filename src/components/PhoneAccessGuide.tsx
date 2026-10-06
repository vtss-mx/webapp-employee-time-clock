import { Check, Copy, Info } from 'lucide-react';
import { useCopy } from '../hooks/useCopy';
import { useQrImage } from '../hooks/useQrImage';
import { Trans, useT } from '../i18n';
import { paths } from '../routes/paths';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Dirección para abrir la app en el teléfono; null si solo sirve en este equipo (localhost). */
export function phoneAccessUrl(location: Pick<Location, 'origin' | 'hostname'> = window.location): string | null {
  return LOCAL_HOSTS.includes(location.hostname) ? null : `${location.origin}${paths.login}`;
}

/**
 * Cómo continuar en el dispositivo permitido de un validador (tableta o teléfono): pasos, dirección
 * para copiar y código QR para escanear.
 */
export function PhoneAccessGuide() {
  const t = useT();
  const url = phoneAccessUrl();
  // Si el código no se puede dibujar queda su lugar vacío: la dirección está escrita al lado para copiarla.
  const qr = useQrImage(url).src;
  const { copied, copy: copyText } = useCopy();
  const copy = () => url && copyText(url);

  return (
    <div className="phone-guide">
      <div className={`phone-guide__body ${url ? 'has-qr' : ''}`}>
        <ol className="phone-guide__steps">
          <li>
            <strong>{t('qr.phoneGuide.open')}</strong> {t('qr.phoneGuide.openHow')}
          </li>
          <li>
            {url ? (
              <>
                <Trans k="qr.phoneGuide.scanOrType" values={{ scan: <strong>{t('qr.phoneGuide.scanCode')}</strong> }} />
                <span className="phone-guide__url">
                  <code>{url}</code>
                  <button type="button" onClick={copy} aria-label={t('qr.phoneGuide.copyAddress')}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </span>
              </>
            ) : (
              <Trans k="qr.phoneGuide.enterAddress" values={{ address: <strong>{t('qr.phoneGuide.accessAddress')}</strong> }} />
            )}
          </li>
          <li>
            <Trans k="qr.phoneGuide.signIn" values={{ action: <strong>{t('qr.phoneGuide.signInAction')}</strong> }} />
          </li>
        </ol>
        {url && (
          <figure className="phone-guide__qr">
            {qr ? (
              <img src={qr} alt={t('qr.phoneGuide.qrAlt')} width={168} height={168} />
            ) : (
              <span className="phone-guide__qr-placeholder" />
            )}
            <figcaption>{t('qr.phoneGuide.scan')}</figcaption>
          </figure>
        )}
      </div>
      <p className="phone-guide__note">
        <Info size={18} />
        <span>
          <Trans k="qr.phoneGuide.desktopSite" values={{ option: <strong>{t('qr.phoneGuide.desktopSiteOption')}</strong> }} />
        </span>
      </p>
    </div>
  );
}
