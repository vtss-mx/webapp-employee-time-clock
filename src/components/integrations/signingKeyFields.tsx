import { CalendarClock, KeyRound, RefreshCw, Signature, Upload } from 'lucide-react';
import { useState } from 'react';
import { TextAreaField } from '../FormField';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { FilePicker } from '../ui/FilePicker';
import { NumberField } from '../ui/NumberField';
import { PanelSection } from '../ui/Panel';
import { RadioCard } from '../ui/RadioCard';
import { SelectField } from '../ui/formFields';
import { Trans, useT } from '../../i18n';
import type { SigningKey, SigningKeyLimits } from '../../types';
import { NO_REPLACES } from '../../utils/signingKeys';

/**
 * Secciones del formulario de una clave de firma. Están aparte de la pantalla para que cada una se lea sola y la
 * pantalla se quede con lo suyo (cargar, confirmar, enviar y explicar el error).
 *
 * Ningún número de aquí está escrito en la app (regla 25 de la raíz): el tope de vigencia y los días de gracia
 * llegan en `limits`, que envía el servidor con el listado.
 */

/** De dónde sale el par: la empresa registra su clave pública (lo recomendado) o la plataforma lo genera. */
export type SigningKeySource = 'own' | 'platform';

/**
 * Formas en que el servidor acepta la clave pública: son CÓDIGOS, iguales en todos los idiomas (lo mismo que `page`
 * y `size` en la guía de conexión). El algoritmo exacto lo dice el servidor en su 422 y cada clave muestra el suyo
 * (`algorithm`): la app no lo repite.
 */
const PEM = 'PEM';
const DER = 'DER';
const BASE64 = 'base64';

/** Por qué registrar la propia clave pública es el camino recomendado. */
function WhyOwnKey() {
  const t = useT();
  return (
    <div className="callout" role="note">
      <span className="icon-tile icon-tile--success">
        <Signature size={22} />
      </span>
      <div className="callout__body">
        <strong>{t('signingKeys.form.why.title')}</strong>
        <p className="muted small">{t('signingKeys.form.why.message')}</p>
      </div>
    </div>
  );
}

/** Las dos formas de tener el par, con el motivo por el que una es mejor que la otra. */
export function SourceSection({ value, onChange }: { value: SigningKeySource; onChange: (next: SigningKeySource) => void }) {
  const t = useT();
  return (
    <PanelSection title={t('signingKeys.form.path')} icon={<KeyRound size={20} />}>
      <ChoiceGroup label={t('signingKeys.form.path')} radio className="choice-group--cards">
        <RadioCard
          name="signing-key-source"
          value="own"
          checked={value === 'own'}
          onChange={onChange}
          icon={<Signature size={20} />}
          title={t('signingKeys.form.own.title')}
          description={t('signingKeys.form.own.description')}
        />
        <RadioCard
          name="signing-key-source"
          value="platform"
          checked={value === 'platform'}
          onChange={onChange}
          icon={<KeyRound size={20} />}
          title={t('signingKeys.form.platform.title')}
          description={t('signingKeys.form.platform.description')}
        />
      </ChoiceGroup>
      <WhyOwnKey />
    </PanelSection>
  );
}

interface PublicKeySectionProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  /** El archivo no se pudo leer (lo marca la pantalla en el campo). */
  onFileError: () => void;
}

/**
 * La clave PÚBLICA que la empresa registra: se pega o se elige su archivo. El archivo se lee EN EL NAVEGADOR y su
 * contenido se ve en el campo (se puede revisar y corregir); al servidor viaja ese texto, nunca el archivo.
 * Quitarlo vacía el campo. El formato y el largo los decide el SERVIDOR (422 `SIGNING_KEY_INVALID`, marcado en el
 * campo): la app no repite esa regla.
 */
export function PublicKeySection({ value, error, onChange, onFileError }: PublicKeySectionProps) {
  const t = useT();
  // El archivo elegido vive solo en memoria y solo para que el selector lo muestre: lo que se envía es el texto.
  const [file, setFile] = useState<File | null>(null);

  const pick = (chosen: File | null) =>
    void (async () => {
      setFile(chosen);
      if (!chosen) return onChange('');
      try {
        onChange((await chosen.text()).trim());
      } catch {
        onFileError();
      }
    })();

  return (
    <PanelSection title={t('signingKeys.form.publicKey')} icon={<Upload size={20} />}>
      <TextAreaField
        label={t('signingKeys.form.publicKey')}
        placeholder={t('signingKeys.form.publicKeyPlaceholder')}
        value={value}
        rows={5}
        required
        error={error}
        onChange={onChange}
      />
      <p className="muted small">
        <Trans k="signingKeys.form.publicKeyHint" values={{ pem: <code>{PEM}</code>, der: <code>{DER}</code>, base64: <code>{BASE64}</code> }} />
      </p>
      <FilePicker
        label={t('signingKeys.form.file')}
        value={file}
        accept=".pem,.pub,.key,.txt,.b64,text/plain"
        hint={t('signingKeys.form.fileHint')}
        icon={<KeyRound size={22} />}
        onChange={pick}
      />
    </PanelSection>
  );
}

interface LifetimeSectionProps {
  value: string;
  error?: string;
  limits: SigningKeyLimits;
  onChange: (value: string) => void;
}

/** Cuántos días vivirá la clave: el tope y el valor de partida son del servidor. */
export function LifetimeSection({ value, error, limits, onChange }: LifetimeSectionProps) {
  const t = useT();
  return (
    <PanelSection title={t('signingKeys.form.lifetime')} icon={<CalendarClock size={20} />}>
      <NumberField
        label={t('signingKeys.form.expiresIn')}
        value={value}
        min={1}
        max={limits.max_days}
        step={30}
        unit={t('signingKeys.form.daysUnit')}
        error={error}
        hint={t('signingKeys.form.lifetimeHint', { count: limits.max_days })}
        onChange={onChange}
      />
    </PanelSection>
  );
}

interface ReplacesSectionProps {
  value: string;
  error?: string;
  /** Las claves que todavía pueden firmar: solo esas se pueden reemplazar. */
  options: readonly SigningKey[];
  graceDays: number;
  onChange: (value: string) => void;
}

/**
 * Rotación: qué clave reemplaza la nueva. La reemplazada NO muere al instante, sigue firmando los días de gracia
 * que decide el servidor; para cortarla ya, el camino es revocarla desde la lista.
 */
export function ReplacesSection({ value, error, options, graceDays, onChange }: ReplacesSectionProps) {
  const t = useT();
  return (
    <PanelSection title={t('signingKeys.form.replaces')} icon={<RefreshCw size={20} />}>
      <SelectField
        label={t('signingKeys.form.replaces')}
        value={value}
        options={[{ value: NO_REPLACES, label: t('signingKeys.form.replacesNone') }, ...options.map((key) => ({ value: String(key.id), label: key.label, description: key.fingerprint }))]}
        error={error}
        hint={t('signingKeys.form.replacesHint', { count: graceDays })}
        onChange={onChange}
      />
    </PanelSection>
  );
}
