import { ArrowDown, ArrowUp, ListOrdered, Lock, Power, PowerOff, Save } from 'lucide-react';
import { useId, useState } from 'react';
import type { SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import type { AdminVerificationPolicy } from '../../types';
import type { ConfirmInput, ConfirmSource } from '../../types/confirm';
import { enrollmentFlowRows, moveEnrollmentStep, REQUIRED_ENROLLMENT_STEP, toggleEnrollmentStep, type EnrollmentFlowRow } from '../../utils/enrollmentStepRules';
import { formatList } from '../../utils/numbers';
import { describedBy, FieldMessage } from '../FormField';
import { Button } from '../ui/Button';
import { PanelSection } from '../ui/Panel';
import { Switch } from '../ui/Switch';
import { footnote, onOff } from './policyFields';

/** Lo que el ADMIN pidió guardar: el flujo nuevo, su confirmación, su aviso y qué hacer si el servidor lo rechaza. */
export interface EnrollmentStepsSave {
  steps: string[];
  confirm: ConfirmSource;
  notice: () => SuccessNotice;
  onError: (error: unknown) => void;
}

interface EnrollmentStepsSectionProps {
  policy: AdminVerificationPolicy;
  /** Nombre de la empresa: la confirmación dice a quién aplica el cambio. */
  companyName: string;
  /** Lo que se está guardando (los controles quedan ocupados). */
  saving: string | null;
  onSave: (save: EnrollmentStepsSave) => void;
}

/** Solo el 422 del flujo se muestra en el campo; cualquier otra falla ya la explica el popup del guardado. */
const stepsError = (error: unknown) => (error instanceof ApiError && error.code === 'INVALID_ENROLLMENT_STEPS' ? error.message : undefined);

/** El orden completo, legible: «Identificación oficial, Foto inicial e Identificación biométrica». */
const order = (codes: readonly string[], name: (code: string) => string) => formatList(codes.map(name));

/** Pedir un paso o dejar de pedirlo: «antes → después» y, si se quita, la advertencia y la regla de dos personas. */
function toggleConfirm(code: string, on: boolean, name: (code: string) => string, company: string, twoPerson: boolean): ConfirmInput {
  return {
    kind: 'edit',
    tone: on ? 'success' : 'danger',
    icon: on ? <Power size={30} /> : <PowerOff size={30} />,
    eyebrow: t('policy.enrollment.title'),
    title: t(on ? 'policy.enrollment.confirm.enableTitle' : 'policy.enrollment.confirm.disableTitle', { name: name(code) }),
    message: on ? t('policy.enrollment.confirm.enableText', { name: name(code) }) : t('policy.enrollment.warning'),
    changes: [{ label: name(code), before: onOff(!on), after: onOff(on) }],
    note: footnote(company, !on, twoPerson),
    confirmLabel: t(on ? 'policy.toggle.activate' : 'policy.toggle.deactivate'),
    confirmIcon: on ? <Power size={18} /> : <PowerOff size={18} />,
  };
}

/** Mover un paso: el orden entero «antes → después» (cambiar el orden nunca relaja: se piden los mismos pasos). */
function moveConfirm(code: string, before: readonly string[], after: readonly string[], position: number, name: (code: string) => string, company: string): ConfirmInput {
  return {
    kind: 'edit',
    tone: 'primary',
    icon: <ListOrdered size={30} />,
    eyebrow: t('policy.enrollment.title'),
    title: t('policy.enrollment.confirm.moveTitle', { name: name(code), position }),
    message: t('policy.enrollment.confirm.moveText'),
    changes: [{ label: t('policy.enrollment.confirm.order'), before: order(before, name), after: order(after, name) }],
    note: footnote(company, false, false),
    confirmLabel: t('policy.enrollment.confirm.save'),
    confirmIcon: <Save size={18} />,
  };
}

/** Una fila del flujo: su interruptor (el de las capturas, fijo) y los botones para subirla o bajarla. */
function FlowRow({ row, total, saving, onToggle, onMove }: { row: EnrollmentFlowRow; total: number; saving: boolean; onToggle: (on: boolean) => void; onMove: (delta: -1 | 1) => void }) {
  const t = useT();
  const { nameOf, byCode } = useCatalogs();
  const name = nameOf('enrollment_steps', row.code);
  return (
    <li className={`enroll-flow__row ${row.enabled ? 'is-on' : ''}`}>
      <span className="enroll-flow__position" aria-hidden>
        {row.position === null ? <PowerOff size={16} /> : row.position}
      </span>
      <div className="enroll-flow__main">
        <Switch
          icon={row.locked ? <Lock size={20} /> : <ListOrdered size={20} />}
          label={name}
          badge={row.locked ? <span className="badge badge--info">{t('policy.enrollment.required')}</span> : null}
          description={byCode('enrollment_steps', row.code)?.description}
          checked={row.enabled}
          disabled={row.locked}
          busy={saving}
          onChange={onToggle}
        />
        {/* Por qué su interruptor está fijo: es el registro que la empresa aprueba (el servidor no deja quitarlo). */}
        {row.locked && <p className="enroll-flow__locked small muted">{t('policy.enrollment.locked')}</p>}
      </div>
      <div className="enroll-flow__order">
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          icon={<ArrowUp size={18} />}
          aria-label={t('policy.enrollment.moveUp', { name })}
          disabled={!row.canUp || saving}
          onClick={() => onMove(-1)}
        />
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          icon={<ArrowDown size={18} />}
          aria-label={t('policy.enrollment.moveDown', { name })}
          disabled={!row.canDown || saving}
          onClick={() => onMove(1)}
        />
        <span className="enroll-flow__count small muted">
          {row.position === null ? t('policy.enrollment.notAsked') : t('policy.enrollment.position', { position: row.position, total })}
        </span>
      </div>
    </li>
  );
}

/**
 * ADMIN: los PASOS del registro de identidad de una empresa y su ORDEN (decisión del dueño del producto, 2026-10-08:
 * «el proceso de registro facial debe ser dinámico; el ADMIN decide, por empresa, cuáles pasos se piden y en qué
 * orden»; migración 0093). Edita `enrollment_steps` de la política: una lista ORDENADA de códigos de
 * `catalog.enrollment_steps` (estar en la lista = el paso se pide; el orden del arreglo = el orden del flujo).
 *
 * Reglas que se ven en la pantalla, las mismas que exige el servidor (422 `INVALID_ENROLLMENT_STEPS`): la
 * identificación biométrica (`FACE_CAPTURES`) no se puede quitar —es el registro que la empresa aprueba— y su
 * interruptor queda fijo con el motivo como ayuda; queda al menos un paso y ninguno se repite. QUITAR un paso relaja la
 * seguridad: su confirmación lo advierte y el cambio pasa por la regla de dos personas (lo decide el servidor);
 * agregar o reordenar se aplica al momento. Los nombres y las descripciones de los pasos salen del catálogo.
 *
 * Reordenar es con botones propios (regla 12: nada nativo, ninguna librería de arrastre): «Subir» y «Bajar» con su
 * `aria-label` que nombra el paso, tamaño táctil y foco del teclado como cualquier botón de la app.
 */
export function EnrollmentStepsSection({ policy, companyName, saving, onSave }: EnrollmentStepsSectionProps) {
  const t = useT();
  const { active, nameOf } = useCatalogs();
  const [error, setError] = useState<string>();
  const messageId = useId();
  const name = (code: string) => nameOf('enrollment_steps', code);
  const steps = policy.enrollment_steps;
  const rows = enrollmentFlowRows(steps, active('enrollment_steps').map((item) => item.code));
  const total = rows.filter((row) => row.enabled).length;
  const busy = saving === 'enrollment_steps';
  const hint = t('policy.enrollment.note', { step: name(REQUIRED_ENROLLMENT_STEP) });

  const save = (next: string[], confirm: ConfirmSource, notice: () => SuccessNotice) => {
    setError(undefined); // cada intento parte limpio: el 422 anterior ya no describe lo que se está enviando
    onSave({ steps: next, confirm, notice, onError: (failure) => setError(stepsError(failure)) });
  };

  const toggle = (row: EnrollmentFlowRow, on: boolean) =>
    save(
      toggleEnrollmentStep(steps, row.code, on),
      () => toggleConfirm(row.code, on, name, companyName, policy.two_person_rule),
      () => [t(on ? 'policy.enrollment.notice.enabled' : 'policy.enrollment.notice.disabled', { name: name(row.code) }), t('policy.enrollment.notice.text')],
    );

  const move = (row: EnrollmentFlowRow, delta: -1 | 1) => {
    const next = moveEnrollmentStep(steps, row.code, delta);
    save(
      next,
      () => moveConfirm(row.code, steps, next, next.indexOf(row.code) + 1, name, companyName),
      () => [t('policy.enrollment.notice.moved', { name: name(row.code) }), order(next, name)],
    );
  };

  return (
    <PanelSection title={t('policy.enrollment.title')} icon={<ListOrdered size={20} />}>
      <p className="muted small">{t('policy.enrollment.hint')}</p>
      <ol className="enroll-flow" aria-label={t('policy.enrollment.label')} aria-describedby={describedBy(messageId, error, hint)}>
        {rows.map((row) => (
          <FlowRow key={row.code} row={row} total={total} saving={busy} onToggle={(on) => toggle(row, on)} onMove={(delta) => move(row, delta)} />
        ))}
      </ol>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </PanelSection>
  );
}
