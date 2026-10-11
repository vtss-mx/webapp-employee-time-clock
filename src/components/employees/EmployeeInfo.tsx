import { UserRound } from 'lucide-react';
import { t, useT } from '../../i18n';
import type { Employee } from '../../types';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { Avatar } from '../ui/Avatar';
import { PanelSection } from '../ui/Panel';

/** Dato del empleado o "Sin capturar" (RFC, CURP y NSS son opcionales; el teléfono, de cuentas anteriores). */
const orMissing = (value: string | null | undefined) => value || <span className="muted">{t('common.values.empty')}</span>;

/**
 * Datos personales del expediente (los mismos en el expediente vigente y en el de un empleado eliminado):
 * nombre, nacimiento, número, documentos, contacto y desde cuándo está registrado.
 */
export function EmployeeInfo({ employee }: { employee: Employee }) {
  const t = useT();
  return (
    <PanelSection title={t('employees.detail.info')} icon={<UserRound size={20} />} aside={<Avatar name={employee.full_name} src={employee.avatar} size="lg" />}>
      <dl className="details">
        <div>
          <dt>{t('employees.fields.firstName')}</dt>
          <dd>{employee.first_name}</dd>
        </div>
        <div>
          <dt>{t('employees.fields.lastName')}</dt>
          <dd>{employee.last_name}</dd>
        </div>
        <div>
          <dt>{t('employees.fields.birthDate')}</dt>
          <dd>{formatDate(employee.birth_date)}</dd>
        </div>
        <div>
          <dt>{t('common.fields.employeeNumber')}</dt>
          <dd>{orMissing(employee.employee_number)}</dd>
        </div>
        <div>
          <dt>CURP</dt>
          <dd>{orMissing(employee.curp)}</dd>
        </div>
        <div>
          <dt>RFC</dt>
          <dd>{orMissing(employee.rfc)}</dd>
        </div>
        <div>
          <dt>NSS</dt>
          <dd>{orMissing(employee.nss)}</dd>
        </div>
        <div>
          <dt>{t('common.fields.mobilePhone')}</dt>
          <dd>{orMissing(employee.phone && formatPhone(employee.phone))}</dd>
        </div>
        <div>
          <dt>{t('employees.email')}</dt>
          <dd>{employee.email}</dd>
        </div>
        <div>
          <dt>{t('employees.detail.registered')}</dt>
          <dd>{formatDateTime(employee.created_at)}</dd>
        </div>
      </dl>
    </PanelSection>
  );
}
