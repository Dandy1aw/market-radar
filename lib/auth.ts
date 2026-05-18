export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; message: string };

export function requireAdmin(req: Request): AdminAuthResult {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 500, message: 'ADMIN_TOKEN not configured' };

  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing or invalid authorization' };
  }
  const provided = header.slice('Bearer '.length).trim();
  if (provided !== expected) return { ok: false, status: 401, message: 'Invalid token' };
  return { ok: true };
}
