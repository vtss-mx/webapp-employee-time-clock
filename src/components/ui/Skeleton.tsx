import type { CSSProperties } from 'react';
import { useT } from '../../i18n';

export function Skeleton({ width = '100%', height = 14, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ display: 'block', width, height, borderRadius: radius, ...style }} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const t = useT();
  return (
    <div className="card" aria-busy="true" aria-label={t('ui.loading')}>
      <div className="row" style={{ marginBottom: 18 }}>
        <Skeleton width={44} height={44} radius={12} />
        <div style={{ flex: 1, display: 'grid', gap: 8 }}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="30%" height={12} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} width={`${90 - i * 12}%`} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  const t = useT();
  return (
    <div className="table-wrap" aria-busy="true" aria-label={t('ui.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row" style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <Skeleton width={40} height={40} radius={20} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <Skeleton width="35%" height={14} />
            <Skeleton width="22%" height={11} />
          </div>
          <Skeleton width={90} height={24} radius={999} />
        </div>
      ))}
    </div>
  );
}
