import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { NavEntry, NavGroup } from './navigation';

/** ¿La ruta actual es esta opción o una de sus subpantallas? */
const isCurrent = (entry: NavEntry, pathname: string) => pathname === entry.to || pathname.startsWith(`${entry.to}/`);

/** El módulo de la pantalla actual (si la pantalla está en un submenú). */
const activeGroup = (groups: NavGroup[], pathname: string) => groups.find((g) => g.entries.length > 1 && g.entries.some((e) => isCurrent(e, pathname)))?.code ?? null;

function NavItem({ entry, sub = false }: { entry: NavEntry; sub?: boolean }) {
  const { to, label, icon: Icon, badge } = entry;
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${sub ? 'nav-item--sub' : ''} ${isActive ? 'is-active' : ''}`} data-tooltip={label}>
      <Icon size={sub ? 18 : 20} />
      <span className="nav-item__label">{label}</span>
      {badge ? <span className="nav-item__badge">{badge}</span> : null}
    </NavLink>
  );
}

interface SubmenuProps {
  group: NavGroup;
  open: boolean;
  /** La pantalla actual es de este submenú. */
  current: boolean;
  onToggle: () => void;
}

/** Opción con submenú: el módulo (ícono, nombre y flecha) y, abierto, sus pantallas. Cerrado suma sus pendientes. */
function Submenu({ group, open, current, onToggle }: SubmenuProps) {
  const id = useId();
  const pending = group.entries.reduce((sum, entry) => sum + (entry.badge ?? 0), 0);
  const Icon = group.icon;
  return (
    <div className={`nav-menu ${open ? 'is-open' : ''} ${current ? 'has-current' : ''}`}>
      <button type="button" className="nav-item nav-menu__toggle" aria-expanded={open} aria-controls={id} onClick={onToggle} data-tooltip={group.name}>
        <Icon size={20} aria-hidden />
        <span className="nav-item__label">{group.name}</span>
        {!open && pending > 0 && <span className="nav-item__badge">{pending}</span>}
        <ChevronDown size={16} className="nav-menu__chevron" aria-hidden />
      </button>
      {open && (
        <div id={id} className="nav-menu__items">
          {group.entries.map((entry) => (
            <NavItem key={entry.to} entry={entry} sub />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Menú lateral por menús y submenús (los módulos y sus pantallas los define el backend), lo más simple
 * posible: un módulo con una sola pantalla es una opción directa; uno con varias, una opción que
 * despliega su submenú. Solo un submenú abierto a la vez: el de la pantalla actual (se abre solo al
 * navegar) o el que la persona abra. Con el menú contraído (solo íconos) se muestran todas las
 * pantallas, separadas por módulo.
 */
export function SidebarNav({ groups, compact }: { groups: NavGroup[]; compact: boolean }) {
  const { pathname } = useLocation();
  const current = activeGroup(groups, pathname);
  const [state, setState] = useState({ current, open: current });
  // Al navegar a otra pantalla se abre su submenú (y se cierra el anterior), en el mismo render.
  if (state.current !== current) setState({ current, open: current });
  const open = state.current === current ? state.open : current;
  const setOpen = (code: string | null) => setState({ current, open: code });

  return (
    <nav className={`sidebar__nav ${compact ? 'is-compact' : ''}`} aria-label="Menú">
      {groups.map((group) => {
        // Una sola pantalla, sin nombre de módulo (backend anterior) o menú contraído: opciones directas.
        if (group.entries.length === 1 || !group.name || compact) {
          return (
            <div key={group.code || 'otros'} className="nav-block">
              {group.entries.map((entry) => (
                <NavItem key={entry.to} entry={entry} />
              ))}
            </div>
          );
        }
        return (
          <Submenu
            key={group.code}
            group={group}
            open={open === group.code}
            current={current === group.code}
            onToggle={() => setOpen(open === group.code ? null : group.code)}
          />
        );
      })}
    </nav>
  );
}
