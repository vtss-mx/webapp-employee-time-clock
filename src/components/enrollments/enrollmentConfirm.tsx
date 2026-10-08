import { Camera, Mic, ScanFace, Video } from 'lucide-react';
import { t } from '../../i18n/core';
import type { EnrollmentProgress, FaceStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { config } from '../../utils/config';
import type { EnrollmentStepKey } from './enrollmentStepRules';

/** Lo de la persona que cambia la confirmación: su registro anterior se reemplaza (rechazado o nueva verificación). */
export interface EnrollmentOwner {
  face_status?: FaceStatus;
  face_rejection_reason?: string | null;
}

const tips = () => [t('employee.enrollment.tips.light'), t('employee.enrollment.tips.front')];

/** ¿Este registro reemplaza uno anterior? (rechazado, o la empresa pidió verificar de nuevo la identidad). */
export function replacesEnrollment(owner: EnrollmentOwner | null | undefined): boolean {
  return owner?.face_status === 'REJECTED' || (owner?.face_status === 'NOT_ENROLLED' && Boolean(owner.face_rejection_reason));
}

/**
 * La confirmación ANTES de abrir la cámara de un paso (decisión del dueño del producto: lo que crea datos biométricos se
 * confirma antes): qué se abre, qué se hará y, en la foto inicial, si reemplaza la anterior («Repetir foto») o el
 * registro anterior. Se arma al dibujarse (sigue al idioma activo).
 */
export function enrollmentStepConfirm(step: EnrollmentStepKey, progress: EnrollmentProgress, owner?: EnrollmentOwner | null): ConfirmInput {
  const base = { kind: 'create' as const, eyebrow: t('employee.enrollment.title'), confirmLabel: t('employee.enrollment.confirm.open') };
  if (step === 'photo') {
    const note = progress.photo.status === 'done' ? t('employee.enrollment.confirm.replacesPhoto') : replacesEnrollment(owner) ? t('employee.enrollment.confirm.replaces') : undefined;
    return { ...base, icon: <Camera size={30} />, confirmIcon: <Camera size={18} />, title: t('employee.enrollment.confirm.photo.title'), message: t('employee.enrollment.confirm.photo.message'), details: tips(), note };
  }
  if (step === 'captures') {
    return {
      ...base,
      icon: <ScanFace size={30} />,
      confirmIcon: <Camera size={18} />,
      title: t('employee.enrollment.confirm.captures.title'),
      message: t('employee.enrollment.confirm.captures.message', { count: config.enrollmentValidPhotos }),
      details: tips(),
    };
  }
  return {
    ...base,
    icon: <Video size={30} />,
    confirmIcon: <Mic size={18} />,
    title: t('employee.enrollment.confirm.video.title'),
    message: t('employee.enrollment.confirm.video.message', { count: Math.max(1, progress.voice.total - progress.voice.answered) }),
  };
}
