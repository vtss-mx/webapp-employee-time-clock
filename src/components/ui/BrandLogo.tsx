import logo from '../../assets/vt-logo.webp';

/** Ícono oficial de Employee Time Clock (decorativo: el nombre de la app siempre lo acompaña en texto). */
export function BrandLogo({ size = 46 }: { size?: number }) {
  return <img className="brand-logo" src={logo} width={size} height={size} alt="" aria-hidden decoding="async" />;
}
