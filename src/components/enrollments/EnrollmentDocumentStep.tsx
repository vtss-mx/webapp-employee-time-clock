import { AlertCircle, Check, IdCard, Upload } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { EnrollmentStepState } from '../../types';
import { formatDateTime } from '../../utils/format';
import { EmployeeDocumentList, useMyDocumentList } from '../employeeDocuments/EmployeeDocumentList';
import { EmployeeDocumentUploadForm } from '../employeeDocuments/EmployeeDocumentUploadForm';
import { ButtonLink } from '../ui/Button';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';

/*
 * Los pasos de DOCUMENTOS del registro de identidad (decisión del dueño del producto, 2026-10-08: los documentos de
 * identidad son pasos del flujo; la pantalla «Mis documentos» del empleado se retiró el mismo día). Reutilizan lo que
 * ya existía —el escáner, el formulario con OCR y la lista con «Eliminados»— sin duplicar nada (regla 6): aquí solo se
 * dibuja el paso (su nombre y su descripción del catálogo, su estado desde el servidor) y se le pasa al formulario los
 * tipos de documento que ESE paso acepta (`document_types`, los que manda el servidor).
 */

/** Cómo va el paso en una línea: hecho (con la fecha del documento vigente, si la hay) o pendiente. */
function stepFactText(step: EnrollmentStepState): string {
  if (step.status !== 'done') return t('employee.enrollment.document.pending');
  return step.done_at ? t('employee.enrollment.document.done', { date: formatDateTime(step.done_at) }) : t('employee.enrollment.document.doneNoDate');
}

/** Qué pide el paso y cómo va. El nombre y la descripción del paso salen del catálogo (nunca de los diccionarios). */
function StepFact({ step }: { step: EnrollmentStepState }) {
  useT(); // el texto se arma al dibujarse: un cambio de idioma lo traduce sin recargar
  const done = step.status === 'done';
  return (
    <p className={`inline-note small ${done ? '' : 'muted'}`}>
      {done ? <Check size={16} color="var(--success)" /> : <AlertCircle size={16} />}
      <span>{stepFactText(step)}</span>
    </p>
  );
}

/**
 * La pantalla de un paso de documentos: qué pide la empresa, cómo va y los documentos que el empleado ya subió (con su
 * papelera y su restauración, las piezas de siempre). El botón lleva a subir uno; subir otro del mismo grupo reemplaza
 * lo que cumple el paso (así lo decide el servidor).
 */
export function EnrollmentDocumentStep({ step }: { step: EnrollmentStepState }) {
  const t = useT();
  const { nameOf, byCode } = useCatalogs();
  const list = useMyDocumentList();
  const uploadTo = paths.employee.newEnrollmentDocument(step.code);
  // El `div.page` lo pone `StepGate`: aquí solo va la tarjeta del paso.
  return (
    <Panel>
      <PanelHeader
        title={nameOf('enrollment_steps', step.code)}
        subtitle={byCode('enrollment_steps', step.code)?.description}
        backTo={paths.employee.enroll}
        backLabel={t('employee.enrollment.title')}
        actions={
          <ButtonLink to={uploadTo} variant="primary" icon={<Upload size={18} />}>
            {t(step.status === 'done' ? 'employee.enrollment.index.action.replaceDocument' : 'employee.enrollment.index.action.document')}
          </ButtonLink>
        }
      />
      <PanelSection>
        <StepFact step={step} />
      </PanelSection>
      <PanelSection title={t('employeeDocuments.title')} icon={<IdCard size={20} />}>
        <EmployeeDocumentList list={list} />
      </PanelSection>
    </Panel>
  );
}

/**
 * Subir el archivo de un paso de documentos: el formulario de siempre (archivo o foto con el escáner, tipo del
 * catálogo, confirmación antes de subir y el aviso del servidor), limitado a los tipos que ESE paso acepta y de vuelta
 * a la pantalla del paso al terminar.
 */
export function EnrollmentDocumentUpload({ step }: { step: EnrollmentStepState }) {
  const { nameOf } = useCatalogs();
  return <EmployeeDocumentUploadForm types={step.document_types} backTo={paths.employee.enrollDocument(step.code)} backLabel={nameOf('enrollment_steps', step.code)} />;
}
