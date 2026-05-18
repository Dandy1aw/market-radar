import { requireAdmin } from '@/lib/auth';

function makeReq(authHeader: string | undefined): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/x', { method: 'POST', headers });
}

describe('requireAdmin', () => {
  const ORIGINAL = process.env.ADMIN_TOKEN;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = ORIGINAL;
  });

  it('returns 500 when ADMIN_TOKEN is not configured', () => {
    delete process.env.ADMIN_TOKEN;
    const res = requireAdmin(makeReq('Bearer anything'));
    expect(res).toEqual({ ok: false, status: 500, message: 'ADMIN_TOKEN not configured' });
  });

  it('returns 401 when Authorization header is missing', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq(undefined));
    expect(res).toEqual({ ok: false, status: 401, message: 'Missing or invalid authorization' });
  });

  it('returns 401 when header is not Bearer scheme', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Basic secret'));
    expect(res).toEqual({ ok: false, status: 401, message: 'Missing or invalid authorization' });
  });

  it('returns 401 when token does not match', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Bearer wrong'));
    expect(res).toEqual({ ok: false, status: 401, message: 'Invalid token' });
  });

  it('returns ok when token matches', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Bearer secret'));
    expect(res).toEqual({ ok: true });
  });
});
