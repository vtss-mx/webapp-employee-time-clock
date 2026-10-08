import { AudioLines, Mic, Volume2 } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { currentLocale, t } from '../../i18n/core';
import { useT } from '../../i18n';
import type { VerificationPolicy } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { speak, speechSupported } from '../../utils/speech';
import { catalogOptions, TuningRow, type Tuning, type TuningSave } from '../settings/PolicyTuning';
import { Button } from '../ui/Button';
import { PanelSection } from '../ui/Panel';
import { Switch } from '../ui/Switch';

/**
 * El ajuste de la voz con que se dicta la guía: elige un perfil del catálogo `voice_profiles` (misma fila que el nivel
 * del anti-spoofing). Cambiar la voz NO relaja la seguridad (es neutral): su confirmación nunca va en rojo ni pasa por
 * la regla de dos personas; por eso `VoiceGuidanceSection` fuerza `relaxes: false` al guardarlo.
 */
function voiceProfileTuning(policy: VerificationPolicy, { active, byCode, nameOf }: Pick<CatalogApi, 'active' | 'byCode' | 'nameOf'>): Tuning {
  return {
    key: 'voice_profile',
    icon: <Mic size={20} />,
    label: () => t('policy.voice.profile.label'),
    description: byCode('voice_profiles', policy.voice_profile)?.description ?? t('policy.voice.profile.description'),
    enabled: true, // se puede elegir y probar la voz aunque la guía esté apagada (prepararla antes de encenderla)
    value: policy.voice_profile,
    options: catalogOptions(active('voice_profiles')),
    stricter: 'higher',
    pick: (code) => ({
      changes: { voice_profile: code },
      title: () => t('policy.voice.profile.saved'),
      detail: () => t('policy.voice.profile.savedText', { name: nameOf('voice_profiles', code) }),
    }),
  };
}

interface VoiceGuidanceSectionProps {
  policy: VerificationPolicy;
  /** Lo que se está guardando (su control queda ocupado). */
  saving: string | null;
  /** Enciende o apaga la guía por voz (quien guarda pregunta antes; es neutral, no un candado). */
  onToggle: (value: boolean) => void;
  /** Cambia la voz de la guía (quien guarda pregunta antes); nunca relaja la seguridad. */
  onSaveProfile: (save: TuningSave) => void;
}

/**
 * Guía por voz del registro facial (decisión del dueño, 2026-10-08): un interruptor NEUTRAL para encenderla, la voz
 * con que se leen las indicaciones (catálogo `voice_profiles`) y «Probar voz», que la lee en este dispositivo con la
 * síntesis del navegador (sin servicios externos; privacidad por diseño, regla 13). La empresa solo la lee; el ADMIN la
 * configura. «Probar voz» solo aparece si el navegador puede leer en voz alta.
 */
export function VoiceGuidanceSection({ policy, saving, onToggle, onSaveProfile }: VoiceGuidanceSectionProps) {
  const t = useT();
  const catalogs = useCatalogs();
  const preview = () => speak(t('face.speak.sample'), { profile: policy.voice_profile, locale: currentLocale() });
  return (
    <PanelSection title={t('policy.voice.title')} icon={<AudioLines size={20} />}>
      <p className="muted small">{t('policy.voice.hint')}</p>
      <Switch
        icon={<Volume2 size={20} />}
        label={t('policy.options.voiceGuidance.label')}
        description={policy.voice_guidance_enabled ? t('policy.options.voiceGuidance.on') : t('policy.options.voiceGuidance.off')}
        checked={policy.voice_guidance_enabled}
        busy={saving === 'voice_guidance_enabled'}
        onChange={onToggle}
      />
      <div className="stack">
        <TuningRow tuning={voiceProfileTuning(policy, catalogs)} saving={saving} onSave={(save) => onSaveProfile({ ...save, relaxes: false })} />
        {speechSupported() && (
          <Button variant="secondary" icon={<Volume2 size={18} />} onClick={preview}>
            {t('policy.voice.preview')}
          </Button>
        )}
      </div>
    </PanelSection>
  );
}
