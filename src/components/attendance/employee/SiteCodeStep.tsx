import { ArrowRight, Hash, House } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useT } from '../../../i18n';
import { ApiError } from '../../../services/apiClient';
import { isRecord } from '../../../utils/guards';
import { FormField } from '../../FormField';
import { QrScanPanel } from '../../QrScanPanel';
import { Button } from '../../ui/Button';

/** Dígitos del código que muestra el kiosco del sitio. */
const CODE_LENGTH = 6;

/** El QR del kiosco de un sitio: `TC-SITE:{sitio}:{6 dígitos}` (otro QR se descarta al instante). */
export const isSiteCodeQr = (content: string) => /^TC-SITE:[A-Za-z0-9-]{1,64}:\d{6}$/.test(content);

/** Respuestas del servidor que piden (otra vez) el código: falta, es equivocado o vencido, o ya se usó. */
const SITE_CODE_ERRORS: ReadonlySet<string> = new Set(['SITE_CODE_REQUIRED', 'SITE_CODE_INVALID', 'SITE_CODE_USED']);
export const isSiteCodeError = (error: unknown) => error instanceof ApiError && SITE_CODE_ERRORS.has(error.code);

/**
 * Lo que "Mi asistencia" sabe al abrir un registro (viaja en el estado de la navegación): si el sitio pide su código
 * y si hoy se puede checar remoto. Sin él (una dirección abierta a mano) no se pide el código: si hace falta, el
 * servidor lo dice y se pide entonces.
 */
export interface SiteCodeIntent {
  siteCode: boolean;
  remoteAllowed: boolean;
}

export function siteCodeIntent(state: unknown): SiteCodeIntent {
  return { siteCode: isRecord(state) && state.siteCode === true, remoteAllowed: isRecord(state) && state.remoteAllowed === true };
}

interface SiteCodeStepProps {
  /** Hoy se puede checar remoto: "No estoy en el sitio" sigue sin código. */
  remoteAllowed: boolean;
  /** El código: el texto del QR escaneado o los 6 dígitos escritos, tal cual. */
  onCode: (code: string) => void;
  onRemote: () => void;
  onCancel: () => void;
}

/**
 * Paso del código del sitio (antifraude 2b), antes del rostro en la entrada y la salida: escanear el QR del kiosco
 * con la cámara trasera o escribir los 6 dígitos que muestra (teclado numérico). El código vive solo en memoria y se
 * envía tal cual: el servidor lo valida.
 */
export function SiteCodeStep({ remoteAllowed, onCode, onRemote, onCancel }: SiteCodeStepProps) {
  const t = useT();
  const [digits, setDigits] = useState('');
  const ready = digits.length === CODE_LENGTH;
  const typed = (event: SubmitEvent) => {
    event.preventDefault();
    if (ready) onCode(digits);
  };
  return (
    <QrScanPanel
      title={t('myAttendance.siteCode.title')}
      description={t('myAttendance.siteCode.text')}
      busyMessage={t('myAttendance.siteCode.busy')}
      invalidMessage={t('myAttendance.siteCode.invalidQr')}
      accept={isSiteCodeQr}
      onScan={(content) => Promise.resolve(onCode(content))}
      onCancel={onCancel}
    >
      <form className="site-code-form" onSubmit={typed}>
        <FormField
          label={t('myAttendance.siteCode.digits')}
          icon={<Hash size={18} />}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          value={digits}
          hint={t('myAttendance.siteCode.digitsHint')}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        />
        <Button type="submit" variant="primary" size="lg" block iconRight={<ArrowRight size={20} />} disabled={!ready}>
          {t('common.actions.continue')}
        </Button>
      </form>
      {remoteAllowed && (
        <Button variant="secondary" size="lg" block icon={<House size={20} />} onClick={onRemote}>
          {t('myAttendance.siteCode.remote')}
        </Button>
      )}
    </QrScanPanel>
  );
}
