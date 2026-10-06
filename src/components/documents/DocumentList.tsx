import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useSearchList, type SearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import type { CompanyDocumentApi } from '../../services/companyDocumentService';
import type { CompanyDocument } from '../../types/documents';
import { base64ToBlob, saveFile } from '../../utils/download';
import { formatDateTime } from '../../utils/format';
import { formatBytes } from '../../utils/numbers';
import { listEmpty, TrashCells, trashColumns } from '../trash/TrashParts';
import { useRestore } from '../trash/useRestore';
import { Button, ButtonLink } from '../ui/Button';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';
import { deleteDocumentConfirm, documentRestore, type DocumentTypeName } from './documentConfirms';

/** Qué documento se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${'download' | 'delete'}:${number}`;

const loadError = () => t('documents.loadError');
const downloadError = () => t('documents.downloadError');
const deleteError = () => t('documents.deleteError');

/**
 * Documentos de una empresa, paginados en el backend, con su filtro «Todos» / «Eliminados» (sin búsqueda). Vuelve a
 * la página 1 si cambia la empresa (la ruta base del servicio).
 */
export function useDocumentList(service: CompanyDocumentApi): SearchList<CompanyDocument> {
  return useSearchList((query, signal) => service.list({ page: query.page, size: query.size, deleted: query.deleted }, signal), {
    errorTitle: loadError,
    filterKey: service.base,
  });
}

interface DocumentListProps {
  service: CompanyDocumentApi;
  list: SearchList<CompanyDocument>;
  /** Formulario para subir uno (la acción del vacío). */
  uploadTo: string;
  /** Dentro de una sección (la ficha de la empresa del ADMIN): vacío más bajo y paginador compacto. */
  compact?: boolean;
}

/**
 * Tabla ÚNICA de los documentos de una empresa (la del ADMIN en la ficha de la empresa y la pantalla «Documentos» de
 * la empresa): documento, tipo del catálogo, tamaño en MB, quién lo subió y cuándo (con la marca «Plataforma»), nota y
 * acciones. «Descargar» no cambia datos: no se confirma ni avisa al terminar (la descarga es el resultado). Eliminar
 * y restaurar solo aparecen si el backend lo permite a quien lo ve (`can_delete`) y se confirman antes. En pantallas
 * angostas cada fila es una tarjeta con el documento arriba.
 */
export function DocumentList({ service, list, uploadTo, compact = false }: DocumentListProps) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const typeName: DocumentTypeName = (code) => nameOf('company_document_types', code);
  const { busy, run } = useAction<Busy>();
  const { restoring, restore } = useRestore();

  const download = (doc: CompanyDocument) =>
    void run(
      async () => {
        const file = await service.file(doc.id);
        saveFile(base64ToBlob(file.data, file.content_type), file.file_name);
      },
      { busy: `download:${doc.id}`, errorTitle: downloadError },
    );
  const remove = (doc: CompanyDocument) =>
    void run(() => service.remove(doc.id), {
      busy: `delete:${doc.id}`,
      confirm: () => deleteDocumentConfirm(doc, typeName),
      errorTitle: deleteError,
      success: (message) => [message],
      onSuccess: list.retry,
    });
  const restoreDocument = (doc: CompanyDocument) =>
    void restore(doc.id, () => service.restore(doc.id), () => documentRestore(doc, typeName), list.retry);

  const columns = [t('documents.columns.file'), t('documents.columns.type'), t('documents.columns.size')];
  const upload = (
    <ButtonLink to={uploadTo} size={compact ? 'sm' : 'md'} variant="primary" icon={<Upload size={compact ? 16 : 18} />}>
      {t('documents.add')}
    </ButtonLink>
  );
  return (
    <>
      <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
      <ListResults
        list={list}
        columns={list.trash ? [...columns, ...trashColumns()] : [...columns, t('documents.columns.uploaded'), t('documents.columns.note'), t('documents.columns.actions')]}
        pager={{ noun: { one: t('documents.noun.one'), other: t('documents.noun.other') }, variant: compact ? 'compact' : 'default', siblings: compact ? 0 : undefined }}
        empty={listEmpty(list, { empty: { icon: <FileText />, title: t('documents.empty.title'), description: t('documents.empty.description'), action: upload, compact } })}
        renderCells={(doc) => (
          <>
            <DocumentFacts doc={doc} typeName={typeName} />
            {list.trash ? (
              <TrashCells
                record={doc}
                name={doc.file_name}
                restorable={doc.can_delete}
                busy={restoring === doc.id}
                disabled={restoring !== null}
                onRestore={() => restoreDocument(doc)}
              />
            ) : (
              <>
                <DocumentUpload doc={doc} />
                <td data-label={t('documents.columns.note')} className="table__wide">
                  <span className="document-note">{doc.note ?? '—'}</span>
                </td>
                <td className="table__actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={16} />}
                    aria-label={t('documents.downloadLabel', { name: doc.file_name })}
                    loading={busy === `download:${doc.id}`}
                    disabled={busy !== null}
                    onClick={() => download(doc)}
                  >
                    {t('documents.download')}
                  </Button>
                  {doc.can_delete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={<Trash2 size={16} />}
                      title={t('common.actions.delete')}
                      aria-label={t('documents.deleteLabel', { name: doc.file_name })}
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

/** Las celdas que se ven siempre (también en «Eliminados»): el documento, su tipo y su tamaño en MB. */
function DocumentFacts({ doc, typeName }: { doc: CompanyDocument; typeName: DocumentTypeName }) {
  const t = useT();
  return (
    <>
      <td className="table__primary">
        <span className="person">
          <span className="icon-tile">
            <FileText size={18} />
          </span>
          <strong className="truncate">{doc.file_name}</strong>
        </span>
      </td>
      <td data-label={t('documents.columns.type')}>
        <span className="badge badge--info badge--plain document-type">{typeName(doc.type)}</span>
      </td>
      <td data-label={t('documents.columns.size')}>{formatBytes(doc.size)}</td>
    </>
  );
}

/** Cuándo y quién lo subió (el correo literal), con la marca «Plataforma» si lo subió el ADMIN. */
function DocumentUpload({ doc }: { doc: CompanyDocument }) {
  const t = useT();
  return (
    <td data-label={t('documents.columns.uploaded')} className="table__wide">
      <span className="person__info">
        <span>{formatDateTime(doc.uploaded_at)}</span>
        <small className="truncate">{doc.uploaded_by}</small>
        {doc.uploaded_by_platform && (
          <span className="badge badge--muted badge--plain document-platform" title={t('documents.platformHint')}>
            {t('documents.platform')}
          </span>
        )}
      </span>
    </td>
  );
}
