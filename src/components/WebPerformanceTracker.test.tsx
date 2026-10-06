import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WebPerformanceTracker } from './WebPerformanceTracker';

const perf = vi.hoisted(() => ({ stop: vi.fn<() => void>(), start: vi.fn<() => void>(), track: vi.fn<(pathname: string) => void>() }));
vi.mock('../services/perf/webPerformance', () => ({
  startWebPerformance: () => {
    perf.start();
    return perf.stop;
  },
  trackPerfScreen: (pathname: string) => perf.track(pathname),
}));

describe('WebPerformanceTracker', () => {
  it('empieza a medir al montarse, avisa cada cambio de pantalla y se detiene al desmontarse', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/admin/companies/12?tab=x']}>
        <WebPerformanceTracker />
        <Link to="/admin/errors">ir</Link>
      </MemoryRouter>,
    );
    expect(perf.start).toHaveBeenCalledOnce();
    expect(perf.track).toHaveBeenLastCalledWith('/admin/companies/12');
    await userEvent.click(screen.getByRole('link', { name: 'ir' }));
    expect(perf.track).toHaveBeenLastCalledWith('/admin/errors');
    unmount();
    expect(perf.stop).toHaveBeenCalledOnce();
  });
});
