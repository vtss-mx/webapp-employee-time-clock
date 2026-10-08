import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { samplePolicy } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { removeSpeechSupport, spokenTexts } from '../../test/speechSynthesis';
import type { TuningSave } from '../settings/PolicyTuning';
import { VoiceGuidanceSection } from './VoiceGuidanceSection';

const choose = async (control: RegExp, option: string | RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};

describe('VoiceGuidanceSection (decisión del dueño, 2026-10-08)', () => {
  it('muestra el interruptor y la voz vigente, alterna y cambia la voz (nunca relaja la seguridad), y prueba la voz', async () => {
    const onToggle = vi.fn<(value: boolean) => void>();
    const onSaveProfile = vi.fn<(save: TuningSave) => void>() as Mock<(save: TuningSave) => void>;
    renderWithProviders(
      <VoiceGuidanceSection policy={{ ...samplePolicy, voice_guidance_enabled: true, voice_profile: 'FEMALE_WARM' }} saving={null} onToggle={onToggle} onSaveProfile={onSaveProfile} />,
    );
    const toggle = screen.getByRole('switch', { name: 'Guía por voz' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Voz femenina de tono cálido')).toBeInTheDocument(); // descripción de la voz vigente (catálogo)
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);

    await choose(/Voz de la guía/, /Masculina grave/);
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    const save = onSaveProfile.mock.lastCall![0];
    expect(save.changes).toEqual({ voice_profile: 'MALE_DEEP' });
    expect(save.relaxes).toBe(false); // cambiar la voz nunca relaja la seguridad

    await userEvent.click(screen.getByRole('button', { name: 'Probar voz' }));
    expect(spokenTexts()).toContain('Así se oye la guía por voz.');
  });

  it('sin síntesis de voz en el navegador no ofrece «Probar voz»', () => {
    removeSpeechSupport();
    renderWithProviders(<VoiceGuidanceSection policy={samplePolicy} saving={null} onToggle={vi.fn()} onSaveProfile={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Probar voz' })).toBeNull();
  });

  it('una voz que ya no está en el catálogo usa la descripción de respaldo', () => {
    renderWithProviders(<VoiceGuidanceSection policy={{ ...samplePolicy, voice_profile: 'RETIRADA' }} saving={null} onToggle={vi.fn()} onSaveProfile={vi.fn()} />);
    expect(screen.getByText('Voz con que se leen las indicaciones durante el registro.')).toBeInTheDocument();
  });
});
