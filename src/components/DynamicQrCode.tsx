import { CheckCircle2, PauseCircle, RefreshCw, Smartphone, Timer, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { DynamicQrPhase } from '../hooks/useDynamicQr';
import { useErrorPopup } from '../hooks/useFeedback';
import { useQrImage } from '../hooks/useQrImage';
import { t, Trans, useLocale, useT } from '../i18n';
import type { DynamicQr } from '../types';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';

interface DynamicQrCodeProps {
  qr: DynamicQr | null;
  phase: DynamicQrPhase;
  /** Momento (ms) en que vence el código: el anillo se vacía hasta entonces. */
  deadline: number;
  alt: string;
  onRenew: () => void;
  /** Tocar el código (p. ej. ampliarlo). */
  onOpen?: () => void;
  large?: boolean;
}

/** Últimos segundos: el anillo cambia de color para avisar que viene otro código. */
const ENDING_SECONDS = 5;

/** Lo que se ve SOBRE el código cuando no está vigente (usado, reemplazado, en pausa, error). */
function Overlay({ phase, onRenew }: { phase: DynamicQrPhase; onRenew: () => void }) {
  const t = useT();
  const views: Partial<Record<DynamicQrPhase, { icon: ReactNode; title: string; text?: string; action?: string }>> = {
    used: { icon: <CheckCircle2 size={44} />, title: t('qr.dynamic.used.title'), text: t('qr.dynamic.used.text') },
    replaced: {
      icon: <Smartphone size={40} />,
      title: t('qr.dynamic.replaced.title'),
      text: t('qr.dynamic.replaced.text'),
      action: t('qr.dynamic.replaced.action'),
    },
    paused: { icon: <PauseCircle size={40} />, title: t('qr.dynamic.paused.title'), text: t('qr.dynamic.paused.text'), action: t('qr.dynamic.paused.action') },
    error: { icon: <TriangleAlert size={40} />, title: t('qr.dynamic.error'), action: t('common.actions.retry') },
  };
  const view = views[phase];
  if (!view) return null;
  return (
    <div className={`dynamic-qr__overlay dynamic-qr__overlay--${phase}`} role="status">
      <span className="dynamic-qr__overlay-icon" aria-hidden>
        {view.icon}
      </span>
      <strong>{view.title}</strong>
      {view.text && <span className="small">{view.text}</span>}
      {view.action && (
        <Button size="sm" variant="primary" icon={<RefreshCw size={16} />} onClick={onRenew}>
          {view.action}
        </Button>
      )}
    </div>
  );
}

/** Segundos que faltan para `deadline` (redondeo hacia arriba: "1 s" hasta el último instante). */
const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * "Se renueva en N s": el único elemento que se redibuja cada segundo, alineado al cambio de
 * segundo. Quien lo usa le pone `key={deadline}` para empezar de cero con cada código.
 */
export function QrCountdown({ deadline }: { deadline: number }) {
  const t = useT();
  const [seconds, setSeconds] = useState(() => secondsLeft(deadline));
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const ms = deadline - Date.now();
      if (ms > 0) timer = window.setTimeout(tick, ms % 1000 || 1000);
    };
    const tick = () => {
      setSeconds(secondsLeft(deadline));
      schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [deadline]);
  return (
    <p className="dynamic-qr__countdown" aria-live="off">
      <Timer size={16} aria-hidden /> <Trans k="qr.dynamic.renewsIn" values={{ seconds: <strong>{t('qr.dynamic.seconds', { value: seconds })}</strong> }} />
    </p>
  );
}

/**
 * Tiempos del anillo para CSS (`.dynamic-qr--ready`): dura la vigencia del código y arranca en el
 * punto en que va (al ampliarlo a medio camino no vuelve a empezar). Se calcula UNA vez por código:
 * si cambiara en cada render, el navegador recalcularía la animación con otro retraso.
 */
function ringStyle(life: number, deadline: number): CSSProperties {
  const elapsed = Math.min(life, Math.max(0, life - (deadline - Date.now()) / 1000));
  return {
    '--qr-life': `${life}s`,
    '--qr-drain-delay': `${-elapsed}s`,
    '--qr-warn-delay': `${life - ENDING_SECONDS - elapsed}s`,
  } as CSSProperties;
}

/**
 * El anillo de UN código que dura `life` segundos (se monta de nuevo con cada código: su animación empieza de cero);
 * también el del kiosco de un sitio. Sin código (`life` null), sin animación.
 */
export function QrRing({ life, deadline, className, children }: { life: number | null; deadline: number; className: string; children: ReactNode }) {
  const [style] = useState(() => (life ? ringStyle(life, deadline) : undefined));
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Código QR dinámico: el código (dibujado en el teléfono a partir de su contenido) dentro de un
 * anillo que se vacía con su vigencia y cambia de color en los últimos segundos (animación CSS: la
 * pantalla no se redibuja) y, encima, el estado cuando deja de servir. Cada código nuevo entra con
 * una animación.
 */
export function DynamicQrCode({ qr, phase, deadline, alt, onRenew, onOpen, large = false }: DynamicQrCodeProps) {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce
  const { src, error: imageError, retry: retryImage } = useQrImage(qr?.content, { width: large ? 640 : 480, dark: '#000000' });
  useErrorPopup(imageError, { title: () => t('qr.dynamic.imageError'), retry: retryImage });
  // Código vigente que no se pudo dibujar: en su lugar queda "Reintentar" (el motivo ya se explicó
  // en el popup), nunca un esqueleto que carga para siempre.
  const imageFailed = imageError !== null && (phase === 'loading' || phase === 'ready');
  const shown: DynamicQrPhase = imageFailed ? 'error' : phase;
  const classes = ['dynamic-qr', `dynamic-qr--${shown}`, large && 'dynamic-qr--large'].filter(Boolean).join(' ');
  const image = qr && src && <img key={qr.id} src={src} alt={alt} className="dynamic-qr__image" />;
  return (
    <QrRing key={qr?.id ?? 'none'} life={qr?.lifetime_seconds ?? null} deadline={deadline} className={classes}>
      <div className="dynamic-qr__frame">
        {!image && (shown === 'loading' || shown === 'ready') && <Skeleton width="100%" height="100%" radius={14} />}
        {image &&
          (onOpen ? (
            <button type="button" className="dynamic-qr__button" onClick={onOpen} aria-label={t('qr.dynamic.enlarge')}>
              {image}
            </button>
          ) : (
            image
          ))}
        <Overlay phase={shown} onRenew={imageFailed ? retryImage : onRenew} />
      </div>
    </QrRing>
  );
}
