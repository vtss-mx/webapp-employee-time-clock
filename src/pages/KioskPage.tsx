import { CloudOff, KeyRound, Link2, PauseCircle, Tablet } from 'lucide-react';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { QrCountdown, QrRing } from '../components/DynamicQrCode';
import { FormField } from '../components/FormField';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PageLoader } from '../components/Spinner';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useSubmit } from '../hooks/useAction';
import { useScreenAwake } from '../hooks/useDynamicQr';
import { useKioskDisplay, type KioskPlace } from '../hooks/useKioskDisplay';
import { useQrImage } from '../hooks/useQrImage';
import { t, useT } from '../i18n';
import type { KioskCode } from '../types';
import type { ConfirmInput } from '../types/confirm';

/** Caracteres del código de vinculación (`XXXXX-XXXXX`, sin contar el guion). */
const PAIRING_LENGTH = 10;
/** Lo escrito en mayúsculas, solo letras y números, con el guion a la mitad (como lo genera el servidor). */
function normalizePairing(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PAIRING_LENGTH);
  return raw.length > PAIRING_LENGTH / 2 ? `${raw.slice(0, PAIRING_LENGTH / 2)}-${raw.slice(PAIRING_LENGTH / 2)}` : raw;
}

/** Vincular se confirma (cambia el kiosco del sitio): nada se vincula por un enlace abierto por accidente. */
function pairConfirm(code: string): ConfirmInput {
  return {
    kind: 'action',
    icon: <Link2 size={30} />,
    title: t('kiosk.display.pairConfirmTitle'),
    message: t('kiosk.display.pairConfirmMessage'),
    details: [{ label: t('kiosk.pairing.code'), value: code }],
    note: t('kiosk.display.pairConfirmNote'),
    confirmLabel: t('kiosk.display.pair'),
    confirmIcon: <Link2 size={18} />,
  };
}

/** Pantalla centrada de la tableta: ícono, título, texto y lo demás. */
function KioskNotice({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <section className="kiosk__notice" role="status">
      <span className="kiosk__notice-icon" aria-hidden>
        {icon}
      </span>
      <h1>{title}</h1>
      {children}
    </section>
  );
}

/** El sitio y la empresa, arriba de cualquier pantalla de la tableta ya vinculada. */
function PlaceHeader({ place }: { place: KioskPlace | null }) {
  if (!place) return null;
  return (
    <header className="kiosk__place">
      <span className="kiosk__company">{place.company}</span>
      <strong className="kiosk__site">{place.site}</strong>
    </header>
  );
}

/** Vincular esta tableta con el código de un solo uso que generó la empresa (formulario o enlace `#pair=`). */
function PairingForm({ initialCode, onPair }: { initialCode: string; onPair: (code: string) => Promise<void> }) {
  const t = useT();
  const [code, setCode] = useState(() => normalizePairing(initialCode));
  const { saving, submit } = useSubmit();
  const ready = code.length === PAIRING_LENGTH + 1;
  const send = (event: SubmitEvent) => {
    event.preventDefault();
    if (!ready || saving) return;
    void submit(() => onPair(code), () => t('kiosk.display.pairError'), { confirm: () => pairConfirm(code) });
  };
  return (
    <form className="kiosk__pairing" onSubmit={send}>
      <BrandLogo size={56} />
      <h1>{t('kiosk.display.pairTitle')}</h1>
      <p className="kiosk__muted">{t('kiosk.display.pairText')}</p>
      <FormField
        label={t('kiosk.pairing.code')}
        icon={<KeyRound size={18} />}
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={PAIRING_LENGTH + 1}
        disabled={saving}
        hint={t('kiosk.display.pairHint')}
        onChange={(e) => setCode(normalizePairing(e.target.value))}
      />
      <Button type="submit" variant="primary" size="lg" block icon={<Link2 size={20} />} loading={saving} disabled={!ready}>
        {t('kiosk.display.pair')}
      </Button>
      <LanguageSwitcher variant="compact" />
    </form>
  );
}

/** El código vigente: los 6 dígitos muy grandes, su QR dentro del anillo que se vacía y cuándo cambia. */
function CodeView({ code, deadline }: { code: KioskCode; deadline: number }) {
  const t = useT();
  const { src } = useQrImage(code.qr, { width: 640, dark: '#000000' });
  return (
    <div className="kiosk__code-view">
      <div className="kiosk__digits">
        <span className="kiosk__label">{t('kiosk.display.codeLabel')}</span>
        <p className="kiosk__code lining-nums tabular-nums" aria-label={code.code.split('').join(' ')}>
          <span>{code.code.slice(0, 3)}</span>
          <span>{code.code.slice(3)}</span>
        </p>
        <QrCountdown key={deadline} deadline={deadline} />
      </div>
      <QrRing key={`${code.qr}-${deadline}`} life={code.period_seconds} deadline={deadline} className="dynamic-qr dynamic-qr--ready kiosk__qr">
        <div className="dynamic-qr__frame">{src ? <img src={src} alt={t('kiosk.display.qrAlt')} className="dynamic-qr__image" /> : <Skeleton width="100%" height="100%" radius={14} />}</div>
      </QrRing>
      <p className="kiosk__muted kiosk__hint">{t('kiosk.display.hint')}</p>
    </div>
  );
}

/**
 * Tableta de un sitio (/kiosk, pública y sin sesión; antifraude 2b): a pantalla completa y en alto contraste muestra el
 * código del sitio que el personal escanea o escribe al checar su entrada y su salida. Se vincula una vez (formulario o
 * enlace con `#pair=`); después, el código cambia solo, la pantalla no se apaga y, sin conexión, el último código se ve
 * mientras sirve.
 */
export function KioskPage() {
  const t = useT();
  const { view, place, pair } = useKioskDisplay();
  useScreenAwake();
  if (view.kind === 'loading') return <PageLoader fullscreen />;
  return (
    <main className={`kiosk kiosk--${view.kind}`}>
      {view.kind !== 'pairing' && <PlaceHeader place={place} />}
      {view.kind === 'pairing' && <PairingForm key={view.code} initialCode={view.code} onPair={pair} />}
      {view.kind === 'code' && <CodeView code={view.code} deadline={view.deadline} />}
      {view.kind === 'offline' && (
        <KioskNotice icon={<CloudOff size={64} />} title={t('kiosk.display.offlineTitle')}>
          <p className="kiosk__muted">{t('kiosk.display.offlineText')}</p>
        </KioskNotice>
      )}
      {view.kind === 'disabled' && (
        <KioskNotice icon={<PauseCircle size={64} />} title={t('kiosk.display.disabledTitle')}>
          <p className="kiosk__muted">{view.error.message}</p>
        </KioskNotice>
      )}
      <footer className="kiosk__footer">
        <Tablet size={16} aria-hidden /> {t('kiosk.display.footer')}
      </footer>
    </main>
  );
}
