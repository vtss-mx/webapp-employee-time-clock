import { Compass } from 'lucide-react';
import { useT } from '../i18n';
import { SystemStatusPage } from './SystemStatusPage';

export function NotFoundPage() {
  const t = useT();
  return <SystemStatusPage code="404" icon={<Compass size={32} />} title={t('system.notFound.title')} text={t('system.notFound.text')} />;
}
