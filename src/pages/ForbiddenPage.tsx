import { ShieldAlert } from 'lucide-react';
import { useT } from '../i18n';
import { SystemStatusPage } from './SystemStatusPage';

export function ForbiddenPage() {
  const t = useT();
  return <SystemStatusPage code="403" icon={<ShieldAlert size={32} />} tone="danger" title={t('system.forbidden.title')} text={t('system.forbidden.text')} />;
}
