import { afterEach, describe, expect, it, vi } from 'vitest';

// The dev server's port and proxy target come from `.env` (or the process environment, which wins), read by
// vite.config.ts at load time. Each case loads the config fresh so the env it sees is the one the case set.
async function loadServer() {
  vi.resetModules();
  const config = (await import('../../vite.config')).default as {
    server: { port: number; strictPort: boolean; proxy: Record<string, { target: string }> };
  };
  return config.server;
}

describe('vite dev server settings', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 5173 and refuses to move to another port when it is taken', async () => {
    vi.stubEnv('FRONTEND_DEV_PORT', '');
    const server = await loadServer();
    expect(server.port).toBe(5173);
    expect(server.strictPort).toBe(true);
  });

  it('listens on FRONTEND_DEV_PORT when it is set', async () => {
    vi.stubEnv('FRONTEND_DEV_PORT', '5199');
    expect((await loadServer()).port).toBe(5199);
  });

  it('proxies /api to VITE_DEV_API_TARGET when it is set', async () => {
    vi.stubEnv('VITE_DEV_API_TARGET', 'http://localhost:28000');
    expect((await loadServer()).proxy['/api']?.target).toBe('http://localhost:28000');
  });
});
