import type { RefObject } from 'react';
import { useCatalogs } from '../hooks/useCatalogs';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { useT } from '../i18n';
import type { LazyText } from '../i18n/lazy';
import { formatRate } from '../utils/numbers';
import { accessoryIcon } from './accessories';
import { GUIDE_VIEWBOX, HAIRLINE_PATH, HEAD_PATH, SHOULDERS_PATH } from './faceGuideShape';
import { CrossfadeText } from './ui/CrossfadeText';
import { ProgressRing } from './ui/ProgressRing';

/** `bad` = rojo: solo en el contexto de la toma de fotos (`captureTone`), para «no enfocado / fuera de posición». */
export type Tone = 'idle' | 'warn' | 'ok' | 'busy' | 'bad';

export function guidanceTone(guidance: FaceGuidance): Tone {
  if (guidance === 'hold_still' || guidance === 'ready') return 'ok';
  if (guidance === 'no_face' || guidance === 'loading') return 'idle';
  return 'warn';
}

interface FaceGuideProps {
  tone: Tone;
  /** La indicación (una sola, grande): con una función se escribe al dibujarse y cambia con un fundido cruzado. */
  message: LazyText;
  /** Dato breve bajo la indicación (p. ej. «Foto 12 de 36»): cambia sin fundido y no se anuncia en cada cambio. */
  detail?: string | null;
  /** 0..1: avance de las fotos del escaneo (el anillo verde, continuo). */
  progress?: number;
  /** Etapa del flujo (clase `face-scan--<etapa>`: la guía se retira solo al confirmar). */
  stage?: string;
  /** Se tomaron todas las fotos: el anillo queda completo. */
  complete?: boolean;
  /** El círculo de la guía: con él la detección mide el encuadre contra lo que se dibuja (`guideTarget`). */
  ref?: RefObject<HTMLDivElement | null>;
}

/** Los tres trazos de la guía, cada uno con su halo oscuro debajo (se ve sobre un rostro claro o una pared blanca). */
const GUIDE_PATHS = [HEAD_PATH, HAIRLINE_PATH, SHOULDERS_PATH];

/**
 * Escáner facial (sobrio, con la marca y los tokens propios; decisión del dueño, 2026-10-06: «algo más enterprise»):
 * sobre la tarjeta blanca, la cámara en un círculo con la GUÍA del rostro (decisión del dueño, 2026-10-07: un contorno
 * blanco, grueso y nítido con forma de rostro —óvalo con mentón, línea del cabello y hombros— que la persona alinea
 * con su cara; verde con el rostro bien colocado, color de aviso cuando no lo está; nunca se oculta durante las fotos y
 * se retira solo al confirmar) y un anillo fino que se llena con las fotos. Debajo, UNA indicación grande y en vivo
 * para lectores de pantalla. Estados fijos: ningún cambio lleva transición, fundido, luz ni insignia; el anillo
 * completo es la señal de que terminó.
 *
 * Todo se mide con el visor (`--face-d`, unidades de contenedor de `.camera`): nada de medidas fijas ni `matchMedia`.
 * La geometría de la guía vive en `faceGuideShape.ts`, la misma contra la que la detección mide el encuadre.
 */
export function FaceGuide({ tone, message, detail, progress = 0, stage, complete = false, ref }: FaceGuideProps) {
  const t = useT();
  const value = complete ? 1 : progress;
  const classes = ['face-scan', `face-scan--${tone}`, stage && `face-scan--${stage}`, complete && 'face-scan--complete']
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <div ref={ref} className={classes}>
        <div className="face-scan__window" aria-hidden />
        <svg className="face-scan__guide" viewBox={`0 0 ${GUIDE_VIEWBOX} ${GUIDE_VIEWBOX}`} aria-hidden>
          {GUIDE_PATHS.map((d) => (
            <path key={d} className="face-scan__halo" d={d} />
          ))}
          {GUIDE_PATHS.map((d) => (
            <path key={d} className="face-scan__line" d={d} />
          ))}
        </svg>
        <ProgressRing className="face-scan__ring" value={value} label={t(complete ? 'face.flow.captureDone' : 'face.flow.ring', { percent: formatRate(Math.round(value * 100), 0) })} />
      </div>
      <div className={`camera__message camera__message--face camera__message--${tone}`} role="status" aria-live="polite">
        <CrossfadeText className="camera__text" text={message} />
        {detail && (
          <span className="camera__detail" aria-hidden>
            {detail}
          </span>
        )}
      </div>
    </>
  );
}

/**
 * Insignias de los accesorios que el servidor detectó (códigos del catálogo `accessories`): un chip por accesorio con su
 * ícono y su nombre en el idioma activo, en fila bajo el rostro (nunca sobre los ojos). Es el ÚNICO aviso de un accesorio
 * (decisión del dueño, 2026-10-07: ningún texto pide retirar nada); si la política lo bloquea, la validación del servidor
 * lo rechaza y el flujo se reanuda con la insignia a la vista. Estados fijos: aparece y desaparece sin animación.
 */
export function AccessoryBadges({ items }: { items: string[] }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (items.length === 0) return null;
  return (
    <ul className="accessory-badges" aria-label={t('face.accessories.detected')}>
      {items.map((code) => {
        const Icon = accessoryIcon(code);
        return (
          <li key={code} className="accessory-badge">
            <span className="accessory-badge__icon">
              <Icon size={18} />
            </span>
            {nameOf('accessories', code)}
          </li>
        );
      })}
    </ul>
  );
}

/** Visor para lectura de QR. */
export function QrGuide({ message, tone = 'idle' }: { message: string; tone?: Tone }) {
  return (
    <>
      <div className={`qr-guide qr-guide--${tone}`} aria-hidden>
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__line" />
      </div>
      <div key={message} className={`camera__message camera__message--${tone}`} role="status" aria-live="polite">
        {message}
      </div>
    </>
  );
}
