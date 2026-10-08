import { DeletedNote, DeletedRecordPage, RestoreButton } from '../../components/trash/TrashParts';
import type { RestoreQuestion } from '../../components/trash/useRestore';
import { Avatar } from '../../components/ui/Avatar';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';

/** Restaurar un validador: cuál regresa (su cuenta y su modo) y que sus fotos no se recuperan. */
export const validatorRestore = (validator: Validator, modeName: string): RestoreQuestion => ({
  title: t('validators.trash.restoreTitle', { name: validator.name }),
  details: [
    { label: t('validators.accessEmail'), value: validator.email },
    { label: t('validators.delete.mode'), value: modeName },
  ],
  note: t('ui.trash.photosGone'),
});

interface DeletedValidatorItemProps {
  validator: Validator;
  busy: boolean;
  disabled: boolean;
  onRestore: () => void;
}

/** Un validador en «Eliminados»: su cuenta, cuándo y quién lo eliminó, y «Restaurar» (sin editar ni sus dispositivos). */
export function DeletedValidatorItem({ validator, busy, disabled, onRestore }: DeletedValidatorItemProps) {
  return (
    <li>
      <Avatar name={validator.name} src={validator.avatar} decorative />
      <span className="validator-list__info">
        <strong className="truncate">{validator.name}</strong>
        <small className="muted truncate">{validator.email}</small>
        <DeletedNote record={validator} />
      </span>
      <span className="validator-list__actions">
        <RestoreButton name={validator.name} busy={busy} disabled={disabled} onRestore={onRestore} />
      </span>
    </li>
  );
}

/**
 * Un validador eliminado (su edición es su detalle): el aviso con cuándo y quién lo eliminó, y «Restaurar»; sin el
 * formulario, sus dispositivos ni su contraseña. Al restaurarlo, `onRestored` muestra su edición vigente.
 */
export function DeletedValidator({ validator, onRestored }: { validator: Validator; onRestored: (validator: Validator) => void }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <DeletedRecordPage
      record={validator}
      name={validator.name}
      subtitle={validator.email}
      backTo={paths.company.validators}
      backLabel={t('validators.back')}
      banner={t('validators.trash.banner')}
      restore={() => validatorService.restore(validator.id)}
      question={() => validatorRestore(validator, nameOf('validator_modes', validator.mode))}
      onRestored={onRestored}
    />
  );
}
