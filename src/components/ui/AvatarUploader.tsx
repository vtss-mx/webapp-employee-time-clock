import { Camera, ImagePlus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useMountedRef } from '../../hooks/useMountedRef';
import { useT, type Translate } from '../../i18n';
import type { AvatarCrop } from '../../types/avatar';
import { bigEnough, cropBox, initialView, type CropView, type Natural } from '../../utils/avatarCrop';
import { config } from '../../utils/config';
import { formatBytes } from '../../utils/numbers';
import { Avatar } from './Avatar';
import { AvatarCropPreview, AvatarCropper, type AvatarCropperLabels } from './AvatarCropper';
import { Button } from './Button';
import { FilePicker } from './FilePicker';
import { UploadProgress } from './UploadProgress';

/** Tipos que acepta el servidor (por su contenido; aquí solo se ayuda a elegir bien). */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Textos del cargador (personalizables). */
export interface AvatarUploaderLabels {
  add: string;
  change: string;
  remove: string;
  pickerLabel: string;
  pickerHint: string;
  choose: string;
  drop: string;
  other: string;
  cancel: string;
  save: string;
  uploading: string;
  preview: string;
}

const defaultLabels = (t: Translate, maxBytes: number): AvatarUploaderLabels => ({
  add: t('avatar.uploader.add'),
  change: t('avatar.uploader.change'),
  remove: t('avatar.uploader.remove'),
  pickerLabel: t('avatar.uploader.pickerLabel'),
  pickerHint: t('avatar.uploader.pickerHint', { max: formatBytes(maxBytes) }),
  choose: t('avatar.uploader.choose'),
  drop: t('avatar.uploader.drop'),
  other: t('avatar.uploader.other'),
  cancel: t('common.actions.cancel'),
  save: t('avatar.uploader.save'),
  uploading: t('avatar.uploader.uploading'),
  preview: t('avatar.uploader.preview'),
});

/** Por qué no se puede usar la foto elegida (código: el texto se arma al dibujarse, en el idioma vigente). */
type Problem = { code: 'type' | 'small' | 'unreadable' } | { code: 'size'; size: number };

type Stage =
  | { kind: 'idle' }
  | { kind: 'pick'; problem: Problem | null }
  | { kind: 'crop'; file: File; url: string; natural: Natural | null; view: CropView };

/** Lo que se está guardando (el botón que lo pidió muestra que trabaja). */
export type AvatarUploaderBusy = 'save' | 'remove' | null;

export interface AvatarUploaderProps {
  /** Nombre de la persona (iniciales y texto alternativo). */
  name: string;
  /** Foto vigente (ruta versionada); sin ella se ven las iniciales. */
  src?: string | null;
  seed?: string | number;
  /** Tamaño máximo (bytes) que se acepta antes de subirla (solo ayuda: el servidor valida). */
  maxBytes?: number;
  /** Pregunta y guarda la foto con su recorte (`preview`: cómo quedará). true si se guardó: el editor se cierra. */
  onSave: (file: File, crop: AvatarCrop, preview: ReactNode) => Promise<boolean>;
  /** Pregunta y quita la foto (`current`: la que se quita). Sin esta función no se ofrece quitarla. */
  onRemove?: (current: ReactNode) => Promise<boolean>;
  busy?: AvatarUploaderBusy;
  labels?: Partial<AvatarUploaderLabels>;
  cropperLabels?: Partial<AvatarCropperLabels>;
}

const MB = 1024 * 1024;

function problemText(t: Translate, problem: Problem, maxBytes: number): string {
  if (problem.code === 'size') return t('avatar.uploader.errors.size', { size: formatBytes(problem.size), max: formatBytes(maxBytes) });
  if (problem.code === 'small') return t('avatar.uploader.errors.small', { min: config.avatarMinSidePx });
  return problem.code === 'type' ? t('avatar.uploader.errors.type') : t('avatar.uploader.errors.unreadable');
}

/**
 * Cargador de la foto de perfil: la foto vigente (o las iniciales) con "Cambiar foto" y "Quitar foto"; al
 * cambiarla, el selector propio de archivos (`FilePicker`: nunca el del navegador a la vista, también se puede
 * soltar la foto) y después el recorte (`AvatarCropper`) con "Guardar foto". Revisa tipo, tamaño (en MB) y lado
 * mínimo antes de subir (solo ayuda); la confirmación y el envío los decide quien lo usa (`onSave`, `onRemove`).
 * La foto elegida vive solo en memoria (URL `blob:` que se libera al terminar).
 */
export function AvatarUploader({ name, src, seed, maxBytes = config.avatarMaxMb * MB, onSave, onRemove, busy = null, ...props }: AvatarUploaderProps) {
  const t = useT();
  const labels = { ...defaultLabels(t, maxBytes), ...props.labels };
  const mounted = useMountedRef();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const url = stage.kind === 'crop' ? stage.url : null;
  // La foto elegida se libera al cambiarla, al terminar o al salir de la pantalla.
  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);

  const choose = (file: File | null) => {
    if (!file) return;
    if (file.type && !(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setStage({ kind: 'pick', problem: { code: 'type' } });
    } else if (file.size > maxBytes) {
      setStage({ kind: 'pick', problem: { code: 'size', size: file.size } });
    } else {
      setStage({ kind: 'crop', file, url: URL.createObjectURL(file), natural: null, view: { zoom: 1, cx: 0, cy: 0 } });
    }
  };

  if (stage.kind === 'idle') {
    return (
      <div className="avatar-uploader">
        <Avatar name={name} src={src} seed={seed} size="xl" />
        <div className="avatar-uploader__actions">
          <Button variant="secondary" icon={<Camera size={18} />} disabled={busy !== null} onClick={() => setStage({ kind: 'pick', problem: null })}>
            {src ? labels.change : labels.add}
          </Button>
          {src && onRemove && (
            <Button
              variant="danger-outline"
              icon={<Trash2 size={18} />}
              loading={busy === 'remove'}
              disabled={busy !== null}
              onClick={() => void onRemove(<Avatar name={name} src={src} seed={seed} size="xl" decorative />)}
            >
              {labels.remove}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (stage.kind === 'pick') {
    return (
      <div className="avatar-uploader avatar-uploader--editing">
        <FilePicker
          label={labels.pickerLabel}
          value={null}
          onChange={choose}
          accept={AVATAR_TYPES.join(',')}
          hint={labels.pickerHint}
          error={stage.problem ? problemText(t, stage.problem, maxBytes) : undefined}
          icon={<ImagePlus size={22} />}
          labels={{ choose: labels.choose, drop: labels.drop }}
        />
        <div className="avatar-uploader__actions">
          <Button variant="ghost" icon={<X size={18} />} onClick={() => setStage({ kind: 'idle' })}>
            {labels.cancel}
          </Button>
        </div>
      </div>
    );
  }

  const { file, natural, view } = stage;
  const saving = busy === 'save';
  // Se puede guardar en cuanto la foto cargó (con su tamaño se calcula el recorte).
  const save = natural
    ? async () => {
        const preview = <AvatarCropPreview src={stage.url} natural={natural} view={view} label={labels.preview} />;
        if ((await onSave(file, cropBox(natural, view), preview)) && mounted.current) setStage({ kind: 'idle' });
      }
    : null;
  const loaded = (size: Natural) =>
    setStage(bigEnough(size) ? { ...stage, natural: size, view: initialView(size) } : { kind: 'pick', problem: { code: 'small' } });
  return (
    <div className="avatar-uploader avatar-uploader--editing">
      <AvatarCropper
        src={stage.url}
        natural={natural}
        view={view}
        disabled={saving}
        labels={props.cropperLabels}
        onChange={(next) => setStage({ ...stage, view: next })}
        onLoad={loaded}
        onError={() => setStage({ kind: 'pick', problem: { code: 'unreadable' } })}
        overlay={saving && <UploadProgress label={labels.uploading} overlay />}
      />
      <div className="avatar-uploader__actions">
        <Button variant="ghost" icon={<RefreshCw size={18} />} disabled={saving} onClick={() => setStage({ kind: 'pick', problem: null })}>
          {labels.other}
        </Button>
        <Button variant="ghost" icon={<X size={18} />} disabled={saving} onClick={() => setStage({ kind: 'idle' })}>
          {labels.cancel}
        </Button>
        <Button variant="primary" icon={<Save size={18} />} loading={saving} disabled={!save || saving} onClick={save ? () => void save() : undefined}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
}
