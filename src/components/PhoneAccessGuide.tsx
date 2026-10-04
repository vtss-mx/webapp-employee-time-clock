import { Check, Copy, Info } from 'lucide-react';
import { useCopy } from '../hooks/useCopy';
import { useQrImage } from '../hooks/useQrImage';
import { paths } from '../routes/paths';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Dirección para abrir la app en el teléfono; null si solo sirve en este equipo (localhost). */
export function phoneAccessUrl(location: Pick<Location, 'origin' | 'hostname'> = window.location): string | null {
  return LOCAL_HOSTS.includes(location.hostname) ? null : `${location.origin}${paths.login}`;
}

const TEXT = { open: 'Abre la tableta o el teléfono.', scan: 'Escanéalo con la tableta o el teléfono', already: '¿Ya estás en una tableta o un teléfono?' };

/**
 * Cómo continuar en el dispositivo permitido de un validador (tableta o teléfono): pasos, dirección
 * para copiar y código QR para escanear.
 */
export function PhoneAccessGuide() {
  const text = TEXT;
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
            <strong>{text.open}</strong> Usa el navegador (Safari, Chrome…) o la cámara.
          </li>
          <li>
            {url ? (
              <>
                <strong>Escanea el código</strong> o escribe esta dirección:
                <span className="phone-guide__url">
                  <code>{url}</code>
                  <button type="button" onClick={copy} aria-label="Copiar dirección">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </span>
              </>
            ) : (
              <>
                <strong>Ingresa a la dirección de acceso</strong> que te proporcionó tu empresa.
              </>
            )}
          </li>
          <li>
            <strong>Inicia sesión</strong> con tu mismo correo y contraseña.
          </li>
        </ol>
        {url && (
          <figure className="phone-guide__qr">
            {qr ? (
              <img src={qr} alt={`Código QR para abrir la aplicación. ${text.scan}`} width={168} height={168} />
            ) : (
              <span className="phone-guide__qr-placeholder" />
            )}
            <figcaption>{text.scan}</figcaption>
          </figure>
        )}
      </div>
      <p className="phone-guide__note">
        <Info size={18} />
        <span>
          {text.already} Desactiva la opción <strong>«Sitio de escritorio»</strong> en el menú de tu navegador y
          vuelve a intentarlo.
        </span>
      </p>
    </div>
  );
}
