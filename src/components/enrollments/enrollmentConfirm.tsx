import { Camera, Mic, ScanFace, Video } from 'lucide-react';
import { t } from '../../i18n/core';
import type { EnrollmentStepState, FaceStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { config } from '../../utils/config';
import type { CameraStepCode } from '../../utils/enrollmentStepRules';

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

/** Las preguntas que faltan del video (la sesión trae solo esas; al menos una). */
const remaining = (step: EnrollmentStepState) => Math.max(1, (step.total ?? 0) - (step.answered ?? 0));

/**
 * La confirmación ANTES de abrir la cámara de un paso (decisión del dueño del producto: lo que crea datos biométricos
 * se confirma antes): qué se abre, qué se hará y, en la foto inicial, si reemplaza la anterior («Repetir foto») o el
 * registro anterior. Se arma al dibujarse (sigue al idioma activo). Los pasos de documentos no pasan por aquí: su
 * formulario pregunta antes de subir el archivo.
 */
export function enrollmentStepConfirm(code: CameraStepCode, step: EnrollmentStepState, owner?: EnrollmentOwner | null): ConfirmInput {
  const base = { kind: 'create' as const, eyebrow: t('employee.enrollment.title'), confirmLabel: t('employee.enrollment.confirm.open') };
  if (code === 'INITIAL_PHOTO') {
    const note = step.status === 'done' ? t('employee.enrollment.confirm.replacesPhoto') : replacesEnrollment(owner) ? t('employee.enrollment.confirm.replaces') : undefined;
    return { ...base, icon: <Camera size={30} />, confirmIcon: <Camera size={18} />, title: t('employee.enrollment.confirm.photo.title'), message: t('employee.enrollment.confirm.photo.message'), details: tips(), note };
  }
  if (code === 'FACE_CAPTURES') {
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
    message: t('employee.enrollment.confirm.video.message', { count: remaining(step) }),
  };
}
