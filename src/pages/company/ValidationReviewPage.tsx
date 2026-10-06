import { AlertTriangle, Camera, Check, CheckCircle2, ImageOff, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { EnrollmentBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { notifyEnrollmentsChanged } from '../../hooks/usePendingEnrollments';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { RetryState } from '../../components/ui/RetryState';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import type { FaceEnrollmentDetail } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { ageFrom, formatDate, formatDateTime, formatPercent } from '../../utils/format';

/** Marcas del análisis automático (catálogo enrollment_flags): nombre corto y explicación para el revisor. */
function describeFlags(flags: string[], { byCode }: CatalogApi): Array<{ code: string; name: string; detail: string }> {
  return flags.map((code) => {
    const flag = byCode('enrollment_flags', code);
    const name = flag?.name ?? code;
    return { code, name, detail: flag?.description ?? name };
  });
}

/** Aceptar: confirma que la persona de la foto es el empleado (con lo que el análisis marcó para revisar). */
function approveConfirm(item: FaceEnrollmentDetail, flagNames: string[]): ConfirmInput {
  return {
    tone: 'success',
    icon: <UserCheck size={30} />,
    eyebrow: t('enrollments.review.approve.eyebrow'),
    title: t('enrollments.review.approve.title', { name: item.full_name }),
    message: t('enrollments.review.approve.message'),
    details: [{ label: t('common.fields.employee'), value: `${item.full_name} · ${item.employee_number}` }, ...flagNames.map((flag) => t('enrollments.review.approve.check', { flag }))],
    confirmLabel: t('enrollments.review.approve.confirm'),
    confirmIcon: <UserCheck size={18} />,
  };
}

/** Lo que el análisis automático comprobó (lo marcado para revisar no se da por verificado). */
function automaticChecks(item: FaceEnrollmentDetail, accessoryFlagged: boolean, spoofFlag: boolean): string[] {
  return [
    t('enrollments.review.checks.singleFace'),
    accessoryFlagged ? null : t('enrollments.review.checks.noAccessories'),
    spoofFlag ? null : t('enrollments.review.checks.realFace'),
    t('enrollments.review.checks.samples', { samples: item.samples }),
    item.liveness_passed ? t('enrollments.review.checks.liveness') : null,
    t('enrollments.review.checks.quality', { quality: formatPercent(item.quality_score) }),
  ].filter((check): check is string => check !== null);
}

const loadError = () => t('enrollments.loadError');
const approveError = () => t('enrollments.review.approve.error');
/** Avisos: se arman al dibujarse (siguen al idioma activo). */
const approved = (name: string): SuccessNotice => [t('enrollments.review.approve.done'), t('enrollments.review.approve.doneText', { name })];
const flagsTitle = () => t('enrollments.review.flags.title');
const flagsText = () => t('enrollments.review.flags.text');

/** Revisión de identidad: foto de referencia vs. datos del empleado → Aceptar / Rechazar. */
export function ValidationReviewPage() {
  const t = useT();
  const { id } = useParams();
  const enrollmentId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const catalogs = useCatalogs();
  const { data: item, error, retry } = useResource((signal) => enrollmentService.get(enrollmentId, signal), enrollmentId, loadError);
  const { busy, run } = useAction();

  const flags = item?.flagged_accessories ?? [];
  const flagged = describeFlags(flags, catalogs);
  const accessoryFlagged = flags.some((code) => catalogs.byCode('accessories', code));
  const spoofFlag = flags.includes('SPOOF');

  // Alertas del análisis automático: se avisan en un popup al abrir una solicitud pendiente.
  useEffect(() => {
    if (item?.status !== 'PENDING') return;
    const reasons = describeFlags(item.flagged_accessories ?? [], catalogs).map((flag) => flag.detail);
    if (reasons.length === 0) return;
    void feedback.warning(flagsTitle, flagsText, {
      details: reasons,
      key: `review-flags-${item.id}`,
    });
  }, [item, feedback, catalogs]);

  const approve = (enrollment: FaceEnrollmentDetail) =>
    run(() => enrollmentService.approve(enrollmentId), {
      confirm: () => approveConfirm(enrollment, flagged.map((flag) => flag.name)),
      errorTitle: approveError,
      success: (res) => approved(res.full_name),
      onSuccess: () => {
        notifyEnrollmentsChanged();
        void navigate(paths.company.validations);
      },
    });

  if (error) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('enrollments.review.title')} backTo={paths.company.validations} backLabel={t('enrollments.back')} />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="page">
        <Panel>
          <PanelGrid>
            <PanelSection>
              <SkeletonRows rows={6} />
            </PanelSection>
            <PanelSection>
              <SkeletonRows rows={6} />
            </PanelSection>
          </PanelGrid>
        </Panel>
      </div>
    );
  }

  const pending = item.status === 'PENDING';
  const checks = automaticChecks(item, accessoryFlagged, spoofFlag);

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('enrollments.review.title')}
          backTo={paths.company.validations}
          backLabel={t('enrollments.back')}
          subtitle={
            <>
              <EnrollmentBadge status={item.status} /> {t('enrollments.review.submittedAt', { date: formatDateTime(item.submitted_at) })}
            </>
          }
        />

        <PanelGrid>
          <PanelSection title={t('enrollments.review.photo')} icon={<Camera size={20} />}>
            <div className="review__photo">
              {item.photo ? (
                <img src={item.photo} alt={t('enrollments.review.photoAlt', { name: item.full_name })} />
              ) : (
                <div className="camera__state">
                  <span className="camera__state-icon">
                    <ImageOff size={32} />
                  </span>
                  <p>{t('enrollments.review.photoDeleted')}</p>
                </div>
              )}
              <span className="review__photo-tag">
                <Camera size={14} /> {t('enrollments.review.liveCapture')}
              </span>
            </div>
            <p className="small muted inline-note">
              <ShieldCheck size={16} color="var(--success)" /> {t('enrollments.review.encrypted')}
            </p>
          </PanelSection>

          <PanelSection
            title={t('enrollments.review.employeeData')}
            icon={<UserCheck size={20} />}
            aside={
              <Link to={paths.company.employee(item.employee_id)} className="btn btn--link btn--sm">
                {t('enrollments.review.openRecord')}
              </Link>
            }
          >
            <dl className="details">
              <div>
                <dt>{t('enrollments.review.fullName')}</dt>
                <dd>{item.full_name}</dd>
              </div>
              <div>
                <dt>{t('common.fields.employeeNumber')}</dt>
                <dd>{item.employee_number}</dd>
              </div>
              <div>
                <dt>{t('employees.fields.birthDate')}</dt>
                <dd>{t('enrollments.review.birthDate', { date: formatDate(item.birth_date), age: ageFrom(item.birth_date) })}</dd>
              </div>
              <div>
                <dt>{t('employees.email')}</dt>
                <dd>{item.email}</dd>
              </div>
            </dl>

            <h3 className="panel__section-title">
              <CheckCircle2 size={20} /> {t('enrollments.review.checks.title')}
            </h3>
            <ul className="checklist stagger">
              {/* Lo que el análisis marcó para revisar (dato de la solicitud, no un aviso). */}
              {flagged.map((flag) => (
                <li key={flag.code} className="checklist__warn" title={flag.detail}>
                  <AlertTriangle size={18} /> {flag.name}
                </li>
              ))}
              {checks.map((c) => (
                <li key={c}>
                  <Check size={18} /> {c}
                </li>
              ))}
            </ul>

            {item.similar && item.similar.length > 0 && (
              <>
                <h3 className="panel__section-title">
                  <Users size={20} /> {t('enrollments.review.similar.title')}
                </h3>
                <p className="muted small">{t('enrollments.review.similar.hint')}</p>
                <ul className="checklist">
                  {item.similar.map((person) => (
                    <li key={person.employee_id} className="checklist__warn">
                      <AlertTriangle size={18} />
                      <Link to={paths.company.employee(person.employee_id)}>
                        {person.full_name} · {person.employee_number}
                      </Link>
                      <span className="small muted">{t('enrollments.review.similar.similarity', { value: formatPercent(person.similarity) })}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!pending && (
              <dl className="details">
                <div>
                  <dt>{t('enrollments.review.resolution')}</dt>
                  <dd>{t('enrollments.review.resolvedBy', { status: catalogs.nameOf('enrollment_statuses', item.status), reviewer: item.reviewed_by ?? '—' })}</dd>
                </div>
                <div>
                  <dt>{t('enrollments.review.reviewedAt')}</dt>
                  <dd>{formatDateTime(item.reviewed_at)}</dd>
                </div>
                {item.rejection_reason && (
                  <div>
                    <dt>{t('common.fields.reason')}</dt>
                    <dd>{t('enrollments.review.quotedReason', { reason: item.rejection_reason })}</dd>
                  </div>
                )}
              </dl>
            )}
          </PanelSection>
        </PanelGrid>

        {pending && (
          <PanelFooter>
            <ButtonLink to={paths.company.rejectValidation(item.id)} variant="danger-outline" size="lg" icon={<UserX size={20} />}>
              {t('enrollments.review.reject')}
            </ButtonLink>
            <Button variant="success" size="lg" icon={<UserCheck size={20} />} loading={busy !== null} onClick={() => void approve(item)}>
              {t('enrollments.review.accept')}
            </Button>
          </PanelFooter>
        )}
      </Panel>

    </div>
  );
}
