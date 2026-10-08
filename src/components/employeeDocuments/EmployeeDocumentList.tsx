import { Download, IdCard, Trash2, Upload } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useSearchList, type SearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { myDocumentService } from '../../services/employeeDocumentService';
import type { EmployeeDocument } from '../../types/employeeDocuments';
import { base64ToBlob, saveFile } from '../../utils/download';
import { formatDateTime } from '../../utils/format';
import { listEmpty, TrashCells, trashColumns } from '../trash/TrashParts';
import { useRestore } from '../trash/useRestore';
import { Button, ButtonLink } from '../ui/Button';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';
import { deleteDocumentConfirm, documentRestore, type EmployeeDocumentTypeName } from './employeeDocumentConfirms';

/** Qué documento se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${'download' | 'delete'}:${number}`;

const loadError = () => t('employeeDocuments.loadError');
const downloadError = () => t('employeeDocuments.downloadError');
const deleteError = () => t('employeeDocuments.deleteError');

/** Mis documentos, paginados en el backend, con su filtro «Todos» / «Eliminados» (sin búsqueda). */
export function useMyDocumentList(): SearchList<EmployeeDocument> {
  return useSearchList((query, signal) => myDocumentService.list({ page: query.page, size: query.size, deleted: query.deleted }, signal), {
    errorTitle: loadError,
    filterKey: myDocumentService.base,
  });
}

/**
 * Tabla de los documentos del PROPIO empleado: documento, tipo, estado (revisado por la empresa o en revisión) y cuándo
 * se subió. «Descargar» no cambia datos (no se confirma). Eliminar solo si la empresa aún no lo confirmó; restaurar
 * desde «Eliminados». En pantallas angostas cada fila es una tarjeta.
 */
export function EmployeeDocumentList({ list, uploadTo }: { list: SearchList<EmployeeDocument>; uploadTo: string }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const typeName: EmployeeDocumentTypeName = (code) => nameOf('employee_document_types', code);
  const { busy, run } = useAction<Busy>();
  const { restoring, restore } = useRestore();

  const download = (doc: EmployeeDocument) =>
    void run(
      async () => {
        const file = await myDocumentService.file(doc.id);
        saveFile(base64ToBlob(file.data, file.content_type), file.file_name);
      },
      { busy: `download:${doc.id}`, errorTitle: downloadError },
    );
  const remove = (doc: EmployeeDocument) =>
    void run(() => myDocumentService.remove(doc.id), {
      busy: `delete:${doc.id}`,
      confirm: () => deleteDocumentConfirm(doc, typeName),
      errorTitle: deleteError,
      success: (message) => [message],
      onSuccess: list.retry,
    });
  const restoreDocument = (doc: EmployeeDocument) => void restore(doc.id, () => myDocumentService.restore(doc.id), () => documentRestore(doc, typeName), list.retry);

  const columns = [t('employeeDocuments.columns.file'), t('employeeDocuments.columns.type'), t('employeeDocuments.columns.status')];
  const upload = (
    <ButtonLink to={uploadTo} variant="primary" icon={<Upload size={18} />}>
      {t('employeeDocuments.add')}
    </ButtonLink>
  );
  return (
    <>
      <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
      <ListResults
        list={list}
        columns={list.trash ? [...columns, ...trashColumns()] : [...columns, t('employeeDocuments.columns.uploaded'), t('employeeDocuments.columns.actions')]}
        pager={{ noun: { one: t('employeeDocuments.noun.one'), other: t('employeeDocuments.noun.other') } }}
        empty={listEmpty(list, { empty: { icon: <IdCard />, title: t('employeeDocuments.empty.title'), description: t('employeeDocuments.empty.description'), action: upload } })}
        renderCells={(doc) => (
          <>
            <DocumentFacts doc={doc} typeName={typeName} />
            {list.trash ? (
              <TrashCells record={doc} name={doc.file_name} restorable busy={restoring === doc.id} disabled={restoring !== null} onRestore={() => restoreDocument(doc)} />
            ) : (
              <>
                <td data-label={t('employeeDocuments.columns.uploaded')} className="table__wide">
                  {formatDateTime(doc.uploaded_at)}
                </td>
                <td className="table__actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={16} />}
                    aria-label={t('employeeDocuments.downloadLabel', { name: doc.file_name })}
                    loading={busy === `download:${doc.id}`}
                    disabled={busy !== null}
                    onClick={() => download(doc)}
                  >
                    {t('employeeDocuments.download')}
                  </Button>
                  {!doc.confirmed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={<Trash2 size={16} />}
                      title={t('common.actions.delete')}
                      aria-label={t('employeeDocuments.deleteLabel', { name: doc.file_name })}
                      loading={busy === `delete:${doc.id}`}
                      disabled={busy !== null}
                      onClick={() => remove(doc)}
                    />
                  )}
                </td>
              </>
            )}
          </>
        )}
      />
    </>
  );
}

/** Documento, su tipo y su estado (revisado o en revisión); se ven siempre, también en «Eliminados». */
function DocumentFacts({ doc, typeName }: { doc: EmployeeDocument; typeName: EmployeeDocumentTypeName }) {
  const t = useT();
  return (
    <>
      <td className="table__primary">
        <span className="person">
          <span className="icon-tile">
            <IdCard size={18} />
          </span>
          <strong className="truncate">{doc.file_name}</strong>
        </span>
      </td>
      <td data-label={t('employeeDocuments.columns.type')}>
        <span className="badge badge--info badge--plain document-type">{typeName(doc.type)}</span>
      </td>
      <td data-label={t('employeeDocuments.columns.status')}>
        {doc.confirmed ? (
          <span className="badge badge--success badge--plain" title={t('employeeDocuments.status.confirmedHint')}>
            {t('employeeDocuments.status.confirmed')}
          </span>
        ) : (
          <span className="badge badge--muted badge--plain">{t('employeeDocuments.status.pending')}</span>
        )}
        <small className="muted">{doc.ocr_processed ? t('employeeDocuments.status.read') : t('employeeDocuments.status.notRead')}</small>
      </td>
    </>
  );
}
