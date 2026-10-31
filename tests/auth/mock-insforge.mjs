import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const user = { id: 'ee8e57fc-d3fb-43fd-a07b-6383674b7139', email: 'google-user@example.invalid', profile: { name: 'Nombre de Google' } };
const token = kind => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, kind })).toString('base64url'), 'test-only'].join('.');
const accessToken = token('access');
const refreshToken = token('refresh');
const challenges = new Map();
let profile = null;
let initFailure = false;
let exchangeCalls = 0;
let passwordChanged = false;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:3101');
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
  };
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const input = raw ? JSON.parse(raw) : null;

  if (url.pathname === '/health') return send(200, { ok: true });
  if (url.pathname === '/__test/reset') {
    challenges.clear(); profile = null; initFailure = input?.initFailure ?? false; exchangeCalls = 0; passwordChanged = false;
    return send(200, { ok: true });
  }
  if (url.pathname === '/__test/state') return send(200, { profile, exchangeCalls, passwordChanged });
  if (url.pathname === '/api/auth/email/send-reset-password') return send(200, { success: true, message: 'Check your email' });
  if (url.pathname === '/api/auth/email/exchange-reset-password-token') return input?.code === '123456'
    ? send(200, { token: 'local-password-reset-token' }) : send(400, { error: 'INVALID_CODE', message: 'Invalid code' });
  if (url.pathname === '/api/auth/email/reset-password') {
    if (input?.otp !== 'local-password-reset-token') return send(400, { error: 'INVALID_TOKEN' });
    passwordChanged = true; return send(200, { success: true });
  }
  if (url.pathname === '/api/auth/oauth/google') {
    if (initFailure) return send(503, { error: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable' });
    const code = randomUUID();
    challenges.set(code, url.searchParams.get('code_challenge'));
    return send(200, { authUrl: `https://accounts.google.com/test?code=${code}&redirect_uri=${encodeURIComponent(url.searchParams.get('redirect_uri'))}` });
  }
  if (url.pathname === '/api/auth/oauth/exchange') {
    exchangeCalls++;
    const expected = challenges.get(input?.code);
    if (!expected || createHash('sha256').update(input?.code_verifier ?? '').digest('base64url') !== expected) {
      return send(401, { error: 'INVALID_CODE', message: 'Invalid code or verifier' });
    }
    challenges.delete(input.code);
    return send(200, { user, accessToken, refreshToken });
  }
  if (url.pathname === '/api/auth/sessions/current') {
    return request.headers.authorization === `Bearer ${accessToken}`
      ? send(200, { user }) : send(401, { error: 'UNAUTHORIZED' });
  }
  if (url.pathname === '/api/database/records/menupro_restaurants') return send(200, []);
  if (url.pathname === '/api/database/rpc/menupro_rate_limit') return send(200, true);
  if (url.pathname === '/api/database/rpc/menupro_session') return send(200, {
    business_id: '805fd754-3883-43fc-8350-25cc1c0b82c9', business_role: 'owner', is_admin: false,
    businesses: [{ id: '805fd754-3883-43fc-8350-25cc1c0b82c9', name: 'Mi negocio', role: 'owner' }], restaurants: [], invitations: [],
    subscription: { plan_id: 'local', plan_name: 'Local', max_restaurants: 1, effective_status: 'unstarted', has_access: false },
  });
  if (url.pathname === '/api/database/records/menupro_profiles') {
    if (request.method === 'POST') { profile = input[0]; return send(201, null); }
    return send(200, profile ? [profile] : []);
  }
  send(404, { error: 'Unexpected test endpoint' });
});

server.listen(3101, '127.0.0.1', () => console.log('Local auth test service ready on 3101'));
