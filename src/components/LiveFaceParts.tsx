import { Camera, Volume2, VolumeX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import type { FaceSpeech } from '../hooks/useFaceSpeech';
import { Button } from './ui/Button';

/*
 * Piezas bajo el visor del flujo facial (`LiveFaceFlow`): solo aparecen cuando hacen falta (el obturador de la foto
 * inicial, la captura manual de respaldo y otra forma de identificarse).
 */

export interface FlowAlternative {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

/** Botón que toma una foto: el obturador de la foto inicial (decisión del dueño, 2026-10-07) o la captura manual de respaldo. */
export interface CaptureButton {
  /** Deshabilitado hasta que el cuadro es válido (borde verde): «no se pueden tomar fotos fuera de posición». */
  disabled: boolean;
  onCapture: () => void;
  /** Texto propio (el obturador: «Tomar foto»); sin él, «Capturar» (respaldo manual). */
  label?: string;
}

/**
 * Obturador de la foto inicial (decisión del dueño, 2026-10-07: la foto inicial se toma a mano), captura manual de
 * respaldo (si la detección automática no cargó) y otra forma de identificarse. El obturador va grande (`size="lg"`, ≥ 44 px)
 * y solo se habilita con el cuadro válido.
 */
/**
 * Botón para silenciar la guía por voz, en el encabezado del escáner (decisión del dueño, 2026-10-08). Solo aparece con
 * la guía encendida y con soporte de síntesis; su ícono y su aviso cambian con el estado (silenciado o con voz).
 */
export function VoiceMuteButton({ voice, enabled }: { voice: FaceSpeech; enabled: boolean }) {
  const t = useT();
  if (!enabled || !voice.supported) return null;
  const label = t(voice.muted ? 'face.speak.unmute' : 'face.speak.mute');
  return <Button variant="ghost" iconOnly icon={voice.muted ? <VolumeX size={20} /> : <Volume2 size={20} />} onClick={voice.toggleMute} aria-label={label} title={label} />;
}

export function FlowActions({ shutter, manualCapture, alternative }: { shutter?: CaptureButton | null; manualCapture?: CaptureButton | null; alternative?: FlowAlternative }) {
  const t = useT();
  const capture = shutter ?? manualCapture;
  if (!capture && !alternative) return null;
  return (
    <>
      {capture && (
        <Button variant="primary" size="lg" icon={<Camera size={20} />} disabled={capture.disabled} onClick={capture.onCapture}>
          {capture.label ?? t('face.flow.capture')}
        </Button>
      )}
      {alternative && (
        <Button variant="secondary" size="lg" icon={alternative.icon} onClick={alternative.onSelect}>
          {alternative.label}
        </Button>
      )}
    </>
  );
}
