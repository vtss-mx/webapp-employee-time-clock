import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useT, type Translate } from '../../i18n';
import { clampView, imagePlacement, initialView, maxZoom, panView, sideOf, zoomView, type CropView, type Natural } from '../../utils/avatarCrop';
import { formatNumber } from '../../utils/numbers';
import { Slider } from './Slider';

/** Textos del recorte (personalizables). */
export interface AvatarCropperLabels {
  /** Nombre del recuadro para el lector de pantalla. */
  label: string;
  /** Cómo se usa (con dedo, ratón y teclado). */
  hint: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
}

const defaultLabels = (t: Translate): AvatarCropperLabels => ({
  label: t('avatar.cropper.label'),
  hint: t('avatar.cropper.hint'),
  zoom: t('avatar.cropper.zoom'),
  zoomIn: t('avatar.cropper.zoomIn'),
  zoomOut: t('avatar.cropper.zoomOut'),
});

/** Paso del acercamiento (control, botones y teclas + / −). */
const ZOOM_STEP = 0.1;
/** Cuánto acerca la rueda del ratón por cada píxel que gira (suave en ratones y en el panel táctil). */
const WHEEL_SPEED = 0.0015;
/** Teclas de flecha: mueven la FOTO (como al arrastrarla) una fracción del recuadro; con Mayús, más. */
const ARROWS: Record<string, readonly [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const ARROW_STEP = 0.05;
const ARROW_STEP_FAST = 0.2;

interface AvatarCropperProps {
  /** Foto elegida (URL local `blob:`). */
  src: string;
  /** Tamaño de la foto ya cargada; null mientras carga. */
  natural: Natural | null;
  view: CropView;
  onChange: (view: CropView) => void;
  /** La foto cargó (con su tamaño ya orientado, como la muestra el navegador). */
  onLoad: (natural: Natural) => void;
  /** El navegador no pudo abrirla. */
  onError: () => void;
  disabled?: boolean;
  /** Encima del recorte (p. ej. el avance mientras se guarda). */
  overlay?: ReactNode;
  labels?: Partial<AvatarCropperLabels>;
}

/** Distancia entre dos dedos (pellizcar para acercar). */
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** La vista que pide una tecla (o null si la tecla no es del recorte). */
function viewForKey(natural: Natural, view: CropView, key: string, fast: boolean): CropView | null {
  const arrow = ARROWS[key];
  if (arrow) {
    const step = sideOf(natural, view.zoom) * (fast ? ARROW_STEP_FAST : ARROW_STEP);
    return clampView(natural, { ...view, cx: view.cx + arrow[0] * step, cy: view.cy + arrow[1] * step });
  }
  if (key === '+' || key === '=') return zoomView(natural, view, view.zoom + ZOOM_STEP);
  if (key === '-' || key === '_') return zoomView(natural, view, view.zoom - ZOOM_STEP);
  return key === '0' || key === 'Home' ? initialView(natural) : null;
}

/**
 * Recorte cuadrado de la foto de perfil, con la vista circular de cómo se verá: se arrastra con el dedo o el
 * ratón (eventos de puntero), se acerca pellizcando, con la rueda o con el deslizador (botones − / + de 44 px) y
 * todo funciona con el teclado (flechas, + / −, 0). No mide el recuadro para dibujar: la foto se coloca en
 * porcentajes (`imagePlacement`), igual en un teléfono que en una pantalla grande.
 */
export function AvatarCropper({ src, natural, view, onChange, onLoad, onError, disabled = false, overlay, ...props }: AvatarCropperProps) {
  const t = useT();
  const labels = { ...defaultLabels(t), ...props.labels };
  const hintId = useId();
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ready = natural !== null && !disabled;

  // Rueda: escucha propia y no pasiva (la de React es pasiva y la página se desplazaría al acercar).
  useEffect(() => {
    if (!viewport || !natural || disabled) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      onChange(zoomView(natural, view, view.zoom * Math.exp(-event.deltaY * WHEEL_SPEED)));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [viewport, natural, view, onChange, disabled]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last || !natural) return;
    const next = { x: event.clientX, y: event.clientY };
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
    pointers.current.set(event.pointerId, next);
    if (others.length === 0) {
      onChange(panView(natural, view, next.x - last.x, next.y - last.y, event.currentTarget.getBoundingClientRect().width));
      return;
    }
    const before = distance(last, others[0]);
    if (before > 0) onChange(zoomView(natural, view, view.zoom * (distance(next, others[0]) / before)));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = ready ? viewForKey(natural, view, event.key, event.shiftKey) : null;
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div className={`avatar-cropper ${disabled ? 'is-disabled' : ''}`.trim()}>
      <div
        ref={setViewport}
        className="avatar-cropper__viewport"
        role="group"
        tabIndex={ready ? 0 : -1}
        aria-label={labels.label}
        aria-describedby={hintId}
        aria-busy={!natural || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <img
          className={`avatar-cropper__image ${natural ? 'is-ready' : ''}`.trim()}
          src={src}
          alt=""
          draggable={false}
          style={natural ? imagePlacement(natural, view) : undefined}
          onLoad={(event) => onLoad({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={onError}
        />
        <span className="avatar-cropper__mask" aria-hidden />
        {overlay}
      </div>
      <p id={hintId} className="avatar-cropper__hint">
        {labels.hint}
      </p>
      {natural && (
        <Slider
          className="avatar-cropper__zoom"
          value={view.zoom}
          min={1}
          max={maxZoom(natural)}
          step={ZOOM_STEP}
          disabled={disabled}
          label={labels.zoom}
          format={(value) => t('avatar.cropper.zoomValue', { value: formatNumber(value, 1) })}
          showValue
          decrementLabel={labels.zoomOut}
          incrementLabel={labels.zoomIn}
          decrementIcon={<ZoomOut size={18} />}
          incrementIcon={<ZoomIn size={18} />}
          onChange={(zoom) => onChange(zoomView(natural, view, zoom))}
        />
      )}
    </div>
  );
}

/** Cómo quedará la foto (círculo): en la confirmación antes de guardarla. */
export function AvatarCropPreview({ src, natural, view, label }: { src: string; natural: Natural; view: CropView; label: string }) {
  return (
    <span className="avatar-crop-preview" role="img" aria-label={label}>
      <img src={src} alt="" draggable={false} style={imagePlacement(natural, view)} />
    </span>
  );
}
