import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { NavEntry } from './navigation';

/** Más de esta cantidad de opciones: las primeras van en la barra y el resto en "Más". */
const MAX_TABS = 4;

/**
 * Navegación inferior en teléfonos: las opciones principales al alcance del pulgar (respeta la
 * zona segura del iPhone). Si hay más opciones de las que caben, "Más" abre el menú completo.
 */
export function MobileTabBar({ nav, onMore }: { nav: NavEntry[]; onMore: () => void }) {
  const overflow = nav.length > MAX_TABS;
  const tabs = overflow ? nav.slice(0, MAX_TABS - 1) : nav;
  return (
    <nav className="tabbar" aria-label="Navegación inferior">
      {tabs.map(({ to, label, short, icon: Icon, badge }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`} aria-label={label}>
          <span className="tabbar__icon">
            <Icon size={22} />
            {badge ? <span className="tabbar__badge">{badge}</span> : null}
          </span>
          <span className="tabbar__label">{short ?? label}</span>
        </NavLink>
      ))}
      {overflow && (
        <button type="button" className="tabbar__item" onClick={onMore} aria-label="Más opciones">
          <span className="tabbar__icon">
            <Menu size={22} />
          </span>
          <span className="tabbar__label">Más</span>
        </button>
      )}
    </nav>
  );
}
