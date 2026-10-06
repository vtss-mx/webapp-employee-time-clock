import { Download, FileSearch, ReceiptText, ScrollText, SearchX, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { billingService } from '../../services/billingService';
import type { ChargeStatus, Payment, PaymentStatus } from '../../types';
import { periodText } from '../../utils/billing';
import { catalogOptions } from '../../utils/catalogs';
import { base64ToBlob, saveFile } from '../../utils/download';
import { formatDate } from '../../utils/format';
import { formatMoney } from '../../utils/numbers';
import { CatalogStatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';
import { ListResults } from '../ui/ListResults';
import { Select } from '../ui/Select';

type Choice<T extends string> = T | 'all';

/* Títulos de los popups de falla: se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const chargesError = () => t('billing.charges.loadError');
const paymentsError = () => t('billing.payments.loadError');
const receiptError = () => t('billing.payments.receiptError');
const statementError = () => t('billing.statement.loadError');

/** Filtro por estado de un catálogo con tono ("Todos los estados" + los activos). */
function StatusFilter<T extends string>({ value, onChange, catalog }: { value: Choice<T>; onChange: (value: Choice<T>) => void; catalog: 'charge_statuses' | 'payment_statuses' }) {
  const t = useT();
  const { active } = useCatalogs();
  const options = [{ value: 'all' as const, label: t('billing.filters.allStatuses') }, ...catalogOptions(active(catalog))] as Array<{ value: Choice<T>; label: string }>;
  return (
    <div className="toolbar toolbar--filter">
      <Select<Choice<T>> value={value} onChange={onChange} aria-label={t('billing.filters.byStatus')} options={options} />
    </div>
  );
}

/** Cargos de la empresa (el más reciente primero), cada uno en su moneda: cada uno abre su detalle. */
export function ChargesTab({ companyId }: { companyId: number }) {
  const t = useT();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Choice<ChargeStatus>>('all');
  const list = usePagedList((page, signal) => billingService.charges(companyId, { ...page, status: status === 'all' ? undefined : status }, signal), {
    errorTitle: chargesError,
    filterKey: `${companyId}|${status}`,
  });
  return (
    <div className="stack">
      <StatusFilter<ChargeStatus> value={status} onChange={setStatus} catalog="charge_statuses" />
      <ListResults
        list={list}
        pager={{ noun: { one: t('billing.charges.noun.one'), other: t('billing.charges.noun.other') } }}
        columns={[t('billing.charges.columns.charge'), t('billing.charges.columns.period'), t('billing.charges.columns.due'), t('billing.totals.total'), t('billing.charges.columns.balance'), t('common.fields.status')]}
        onOpen={(charge) => void navigate(paths.admin.charge(companyId, charge.id))}
        empty={
          status === 'all'
            ? { icon: <ReceiptText />, title: t('billing.charges.emptyTitle'), description: t('billing.charges.emptyDescription'), compact: true }
            : { icon: <SearchX />, title: t('billing.charges.noMatchTitle'), description: t('billing.filters.noMatchDescription'), compact: true }
        }
        renderCells={(charge) => (
          <>
            <td className="table__primary">
              <span className="person__info">
                <strong>{t('billing.charges.name', { sequence: charge.sequence })}</strong>
                <small>{t('billing.charges.issuedOn', { date: formatDate(charge.issued_on) })}</small>
              </span>
            </td>
            <td data-label={t('billing.charges.columns.period')} className="table__wide">
              {periodText(charge.period_start, charge.period_end)}
            </td>
            <td data-label={t('billing.charges.columns.due')}>
              {formatDate(charge.due_on)} {charge.overdue && <span className="badge badge--danger">{t('billing.charges.overdue')}</span>}
            </td>
            <td data-label={t('billing.totals.total')}>{formatMoney(charge.total, charge.currency)}</td>
            <td data-label={t('billing.charges.columns.balance')}>{formatMoney(charge.balance, charge.currency)}</td>
            <td data-label={t('common.fields.status')}>
              <CatalogStatusBadge catalog="charge_statuses" code={charge.status} />
            </td>
          </>
        )}
      />
    </div>
  );
}

/** Pagos de la empresa (cada uno en su moneda): el comprobante se descarga y un pago confirmado se puede anular (con motivo). */
export function PaymentsTab({ companyId }: { companyId: number }) {
  const t = useT();
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const action = useAction<number>();
  const [status, setStatus] = useState<Choice<PaymentStatus>>('all');
  const list = usePagedList((page, signal) => billingService.payments(companyId, { ...page, status: status === 'all' ? undefined : status }, signal), {
    errorTitle: paymentsError,
    filterKey: `${companyId}|${status}`,
  });
  // Descargar no cambia datos: no se confirma ni se avisa al terminar (la descarga es el resultado).
  const download = (payment: Payment) =>
    void action.run(
      async () => {
        const file = await billingService.receipt(companyId, payment.id);
        saveFile(base64ToBlob(file.data, file.content_type), file.file_name);
      },
      { busy: payment.id, errorTitle: receiptError },
    );

  return (
    <div className="stack">
      <StatusFilter<PaymentStatus> value={status} onChange={setStatus} catalog="payment_statuses" />
      <ListResults
        list={list}
        pager={{ noun: { one: t('billing.payments.noun.one'), other: t('billing.payments.noun.other') } }}
        columns={[
          t('billing.payments.columns.payment'),
          t('billing.payments.columns.amount'),
          t('billing.payments.columns.applied'),
          t('billing.payments.columns.credit'),
          t('common.fields.status'),
          t('billing.payments.columns.actions'),
        ]}
        empty={
          status === 'all'
            ? { icon: <Wallet />, title: t('billing.payments.emptyTitle'), description: t('billing.payments.emptyDescription'), compact: true }
            : { icon: <SearchX />, title: t('billing.payments.noMatchTitle'), description: t('billing.filters.noMatchDescription'), compact: true }
        }
        renderCells={(payment) => (
          <>
            <td className="table__primary">
              <span className="person__info">
                <strong>{formatDate(payment.paid_on)}</strong>
                <small className="truncate">{[nameOf('payment_methods', payment.method), payment.reference].filter(Boolean).join(' · ')}</small>
              </span>
            </td>
            <td data-label={t('billing.payments.columns.amount')}>{formatMoney(payment.amount, payment.currency)}</td>
            <td data-label={t('billing.payments.columns.applied')}>{formatMoney(payment.applied, payment.currency)}</td>
            <td data-label={t('billing.payments.columns.credit')}>{formatMoney(payment.unapplied, payment.currency)}</td>
            <td data-label={t('common.fields.status')}>
              <CatalogStatusBadge catalog="payment_statuses" code={payment.status} />
              {payment.void_reason && <small className="muted table__note">{payment.void_reason}</small>}
            </td>
            <td className="table__actions">
              {payment.receipt && (
                <Button size="sm" variant="ghost" icon={<Download size={16} />} loading={action.busy === payment.id} disabled={action.busy !== null} title={payment.receipt.file_name} onClick={() => download(payment)}>
                  {t('billing.payments.receipt')}
                </Button>
              )}
              {payment.status === 'CONFIRMED' && (
                <Button size="sm" variant="danger-outline" icon={<Undo2 size={16} />} onClick={() => void navigate(paths.admin.voidPayment(companyId, payment.id), { state: { payment } })}>
                  {t('billing.payments.void')}
                </Button>
              )}
            </td>
          </>
        )}
      />
    </div>
  );
}

/** Estado de cuenta: cargos y pagos con el saldo acumulado tras cada movimiento (positivo = debe), en su moneda. */
export function StatementTab({ companyId }: { companyId: number }) {
  const t = useT();
  const list = usePagedList((page, signal) => billingService.statement(companyId, page, signal), {
    errorTitle: statementError,
    filterKey: String(companyId),
  });
  return (
    <ListResults
      list={list}
      rowKey={(entry) => `${entry.kind}-${entry.id}`}
      pager={{ noun: { one: t('billing.statement.noun.one'), other: t('billing.statement.noun.other') } }}
      columns={[t('billing.statement.columns.movement'), t('common.fields.date'), t('billing.statement.columns.debit'), t('billing.statement.columns.credit'), t('billing.statement.columns.balance')]}
      empty={{ icon: <ScrollText />, title: t('billing.statement.emptyTitle'), description: t('billing.statement.emptyDescription'), compact: true }}
      renderCells={(entry) => (
        <>
          <td className="table__primary">
            <span className="person">
              <span className={`icon-tile ${entry.kind === 'PAYMENT' ? 'icon-tile--success' : ''}`.trim()}>{entry.kind === 'PAYMENT' ? <Wallet size={18} /> : <FileSearch size={18} />}</span>
              <span className="person__info">
                <strong className="truncate">{entry.description}</strong>
                <small>{entry.kind === 'PAYMENT' ? t('billing.statement.payment') : t('billing.statement.charge')}</small>
              </span>
            </span>
          </td>
          <td data-label={t('common.fields.date')}>{formatDate(entry.date)}</td>
          <td data-label={t('billing.statement.columns.debit')}>{formatMoney(entry.debit, entry.currency)}</td>
          <td data-label={t('billing.statement.columns.credit')}>{formatMoney(entry.credit, entry.currency)}</td>
          <td data-label={t('billing.statement.columns.balance')}>
            <strong>{formatMoney(entry.balance, entry.currency)}</strong>
          </td>
        </>
      )}
    />
  );
}
