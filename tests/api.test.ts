import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../api/translate';

const body = {
  provider: 'openai',
  model: 'test-model',
  apiKey: 'test-secret',
  base: 'pt',
  targets: ['en'],
  entries: [{ id: '1', key: 'hello', text: 'Olá {name}' }],
};
async function request(input: unknown = body, method = 'POST', origin = 'http://localhost:5173') {
  const req = {
    method,
    headers: { host: 'localhost:5173', origin },
    body: input,
  } as IncomingMessage & { body: unknown };
  let output = '';
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (text: string) => {
      output = text;
    },
  };
  await handler(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: JSON.parse(output) };
}
afterEach(() => vi.unstubAllGlobals());
describe('translation endpoint', () => {
  it('retries a temporary provider failure without changing the request', async () => {
    const content = JSON.stringify({ translations: [{ id: '1', values: { en: 'Hello {name}' } }] });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    expect(await request()).toEqual({ status: 200, body: JSON.parse(content) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  });
  it('stops after three attempts and preserves provider status without leaking its body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => 'test-secret' });
    vi.stubGlobal('fetch', fetchMock);
    expect(await request()).toEqual({
      status: 502,
      body: { error: 'provider', providerStatus: 503 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('rejects invalid methods, origins, providers and targets before network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await request(body, 'GET')).status).toBe(405);
    expect((await request(body, 'POST', 'https://other.example')).status).toBe(403);
    expect((await request({ ...body, provider: '__proto__' })).status).toBe(400);
    expect((await request({ ...body, targets: ['pt'] })).status).toBe(400);
    expect(
      (
        await request({
          ...body,
          entries: Array.from({ length: 101 }, (_, index) => ({
            ...body.entries[0],
            id: String(index),
          })),
        })
      ).status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['openai', 'openrouter', 'gemini', 'claude'])(
    'normalizes %s suggestions and sends keys only in headers',
    async (provider) => {
      const content = JSON.stringify({
        translations: [{ id: '1', values: { en: 'Hello {name}' } }],
      });
      const response =
        provider === 'gemini'
          ? { candidates: [{ content: { parts: [{ text: content }] } }] }
          : provider === 'claude'
            ? { content: [{ type: 'text', text: content }] }
            : { choices: [{ message: { content } }] };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
      vi.stubGlobal('fetch', fetchMock);
      expect(await request({ ...body, provider })).toEqual({
        status: 200,
        body: JSON.parse(content),
      });
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).not.toContain('test-secret');
      expect(options.body).not.toContain('test-secret');
      expect(JSON.stringify(options.headers)).toContain('test-secret');
    },
  );
  it('rejects suggestions that damage placeholders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ translations: [{ id: '1', values: { en: 'Hello' } }] }),
              },
            },
          ],
        }),
      }),
    );
    expect(await request()).toEqual({ status: 502, body: { error: 'tokens' } });
  });
  it('does not relay provider response bodies or credentials on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'test-secret' }),
    );
    const result = await request();
    expect(result).toEqual({ status: 502, body: { error: 'provider', providerStatus: 401 } });
  });
  it.each([404, 403, 429])(
    'preserves provider status %s for actionable UI errors',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
      expect(await request({ ...body, provider: 'gemini' })).toEqual({
        status: status === 429 ? 429 : 502,
        body: { error: 'provider', providerStatus: status },
      });
    },
  );
});
