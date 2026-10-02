export function Spinner({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span
      className={`spinner ${light ? 'spinner--light' : ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  );
}

export function PageLoader({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="page-loader">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}
