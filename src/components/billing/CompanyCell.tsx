import type { ReactNode } from 'react';

/** Primera celda de una empresa en las listas de cobranza y consumo: sus iniciales, su nombre y un dato. */
export function CompanyCell({ name, detail }: { name: string; detail: ReactNode }) {
  return (
    <td className="table__primary">
      <span className="person">
        <span className="company-row__logo">{name.slice(0, 2).toUpperCase()}</span>
        <span className="person__info">
          <strong className="truncate">{name}</strong>
          <small>{detail}</small>
        </span>
      </span>
    </td>
  );
}
