import { useT } from '../i18n';

/** Acceso visible al archivo legal generado y servido por nuestra propia aplicación. */
export function LegalNoticesLink() {
  const t = useT();
  return (
    <div className="legal-notices">
      <small>{t('app.publisher')}</small>
      <a className="legal-notices__link" href="/third-party-notices.txt">{t('app.thirdPartyNotices')}</a>
    </div>
  );
}
