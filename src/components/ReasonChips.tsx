import { useCatalogs } from '../hooks/useCatalogs';

interface ReasonChipsProps {
  /** Catálogo de motivos sugeridos (solo se ofrecen los activos, en su orden). */
  catalog: 'enrollment_rejection_reasons' | 'reverification_reasons';
  /** Texto del motivo escrito o elegido. */
  value: string;
  onPick: (reason: string) => void;
}

/** Motivos sugeridos como chips: elegir uno lo escribe en el campo del motivo. */
export function ReasonChips({ catalog, value, onPick }: ReasonChipsProps) {
  const { active } = useCatalogs();
  return (
    <div className="chips">
      {active(catalog).map(({ code, name }) => (
        <button key={code} type="button" className={`chip ${value === name ? 'is-active' : ''}`} onClick={() => onPick(name)}>
          {name}
        </button>
      ))}
    </div>
  );
}
