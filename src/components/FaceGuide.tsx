import { Check } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { useT } from '../i18n';
import type { LazyText } from '../i18n/lazy';
import { formatRate } from '../utils/numbers';
import { accessoryIcon } from './accessories';
import { CrossfadeText } from './ui/CrossfadeText';
import { ProgressRing } from './ui/ProgressRing';

export type Tone = 'idle' | 'warn' | 'ok' | 'busy';

/*
 * Silueta de cabeza y hombros (dibujo propio, en el cuadro de 200 × 200 del círculo; el círculo la recorta). La cabeza es
 * amplia (62 % del ancho, del 10 % al 86 % del alto): un rostro a la distancia de una selfie —también el de una laptop,
 * que se ve más grande— queda DENTRO del contorno, sin líneas sobre la boca ni la barbilla. Los hombros son dos trazos
 * cortos abajo, lejos del cuello: insinúan el busto sin cruzar el rostro.
 */
const HEAD = 'M100 20C138 20 162 50 162 90C162 136 134 172 100 172C66 172 38 136 38 90C38 50 62 20 100 20Z';
const SHOULDERS = 'M6 200C16 184 44 174 72 167M194 200C184 184 156 174 128 167';

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
  /** Etapa del flujo (clase `face-scan--<etapa>`: la silueta se atenúa mientras se toman las fotos y los movimientos). */
  stage?: string;
  /** Se están tomando fotos: una luz suave late en la punta del anillo. */
  capturing?: boolean;
  /**
   * El destello de colores está en curso: alrededor del círculo el fondo pasa a un gris oscuro NEUTRO (sin tinte), así
   * por la ventana del destello solo llega a la cara la luz del color que se mide (nunca el blanco de la tarjeta).
   */
  flash?: boolean;
  /** Se tomaron todas las fotos: el anillo se completa y después aparece la marca ✓ al pie del círculo. */
  complete?: boolean;
}

/**
 * Escáner facial (inspirado en una selfie guiada, con la marca y los tokens propios): sobre un fondo claro, la cámara en un
 * círculo con la silueta de cabeza y hombros (fina; verde suave cuando el rostro está bien colocado y atenuada mientras
 * se toman las fotos para no tapar la cara), un anillo fino y continuo que se llena de verde con las fotos y, al
 * terminar, la marca ✓ al pie del círculo. Debajo, UNA indicación grande y en vivo para lectores de pantalla.
 *
 * Todo se mide con el visor (`--face-d`, unidades de contenedor de `.camera`): nada de medidas fijas ni `matchMedia`.
 * Las animaciones son de CSS (transiciones y transformaciones): nada se vuelve a dibujar en React por cuadro.
 */
export function FaceGuide({ tone, message, detail, progress = 0, stage, capturing = false, flash = false, complete = false }: FaceGuideProps) {
  const t = useT();
  const value = complete ? 1 : progress;
  const classes = ['face-scan', `face-scan--${tone}`, stage && `face-scan--${stage}`, flash && 'face-scan--flash', complete && 'face-scan--complete']
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <div className={classes}>
        <div className="face-scan__window" aria-hidden />
        <svg className="face-scan__silhouette" viewBox="0 0 200 200" aria-hidden>
          <path d={HEAD} />
          <path d={SHOULDERS} />
        </svg>
        <ProgressRing
          className="face-scan__ring"
          value={value}
          active={capturing && !complete}
          label={t('face.flow.ring', { percent: formatRate(Math.round(value * 100), 0) })}
        />
        {complete && (
          <span className="face-scan__badge" role="img" aria-label={t('face.flow.captureDone')}>
            <Check strokeWidth={3} aria-hidden />
          </span>
        )}
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

/** Tarjeta animada sobre la cámara con los accesorios (códigos del catálogo) que deben retirarse. */
export function AccessoryAlert({ items }: { items: string[] }) {
  const { nameOf } = useCatalogs();
  if (items.length === 0) return null;
  return (
    <div className="accessory-alert" aria-hidden>
      {items.map((code) => {
        const Icon = accessoryIcon(code);
        return (
          <span key={code}>
            <span>
              <Icon size={30} />
            </span>
            {nameOf('accessories', code)}
          </span>
        );
      })}
    </div>
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
