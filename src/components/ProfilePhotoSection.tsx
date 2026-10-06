import { Camera, Save, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAction } from '../hooks/useAction';
import { useAuth } from '../hooks/useAuth';
import { t, useT } from '../i18n';
import { avatarService } from '../services/avatarService';
import type { AvatarCrop } from '../types/avatar';
import { formatBytes } from '../utils/numbers';
import { AvatarUploader, type AvatarUploaderBusy } from './ui/AvatarUploader';
import { PanelSection } from './ui/Panel';

/**
 * Sección "Foto de perfil" de Mi perfil (todos los roles con la pantalla): subir, cambiar o quitar la foto de la
 * persona. Antes de guardar o quitar pregunta con la vista previa (`useAction` + `confirm`); el error del servidor
 * llega en un popup y el éxito no avisa (la foto nueva ya se ve en el menú y en el perfil).
 */
export function ProfilePhotoSection() {
  // Redibuja al cambiar el idioma; las confirmaciones se arman al dibujarse (siguen al idioma vigente).
  useT();
  const { user, updateAvatar } = useAuth();
  const { busy, run } = useAction<Exclude<AvatarUploaderBusy, null>>();
  if (!user) return null;
  const name = user.employee?.full_name ?? user.email;
  const replacing = Boolean(user.avatar);

  const save = (file: File, crop: AvatarCrop, preview: ReactNode) =>
    run(
      async () => {
        const saved = await avatarService.upload(file, crop);
        updateAvatar(saved.avatar);
      },
      {
        busy: 'save',
        errorTitle: () => t('profile.photo.saveFailed'),
        confirm: () => ({
          kind: replacing ? 'edit' : 'create',
          icon: preview,
          eyebrow: t('profile.photo.saveAsk.eyebrow'),
          title: replacing ? t('profile.photo.saveAsk.titleReplace') : t('profile.photo.saveAsk.titleNew'),
          message: t('profile.photo.saveAsk.message'),
          details: [{ label: t('profile.photo.saveAsk.file'), value: `${file.name} · ${formatBytes(file.size)}` }],
          note: replacing ? t('profile.photo.saveAsk.replaceNote') : t('profile.photo.saveAsk.note'),
          confirmLabel: t('profile.photo.saveAsk.confirm'),
          confirmIcon: <Save size={18} />,
        }),
      },
    );

  const remove = (current: ReactNode) =>
    run(
      async () => {
        await avatarService.remove();
        updateAvatar(null);
      },
      {
        busy: 'remove',
        errorTitle: () => t('profile.photo.removeFailed'),
        confirm: () => ({
          kind: 'delete',
          icon: current,
          eyebrow: t('profile.photo.removeAsk.eyebrow'),
          title: t('profile.photo.removeAsk.title'),
          message: t('profile.photo.removeAsk.message'),
          note: t('profile.photo.removeAsk.note'),
          confirmLabel: t('profile.photo.removeAsk.confirm'),
          confirmIcon: <Trash2 size={18} />,
        }),
      },
    );

  return (
    <PanelSection title={t('profile.photo.title')} icon={<Camera size={20} />}>
      <p className="muted small">{t('profile.photo.description')}</p>
      <AvatarUploader name={name} src={user.avatar} busy={busy} onSave={save} onRemove={remove} />
    </PanelSection>
  );
}
