import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const cookieName = 'controle_producao_sessao';
const durationSeconds = 12 * 60 * 60;

export function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

function cookieValue(expiry, password) {
  return expiry + '.' + createHmac('sha256', password).update(cookieName + ':' + expiry).digest('hex');
}

function equal(a, b) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function fromSameSite(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export function authorize(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return json({ error: 'Configure APP_PASSWORD na Netlify.' }, 503);
  if (!fromSameSite(request)) return json({ error: 'Origem inválida.' }, 403);
  const cookie = (request.headers.get('cookie') || '').split(';')
    .map((part) => part.trim()).find((part) => part.startsWith(cookieName + '='));
  const value = cookie?.slice(cookieName.length + 1) || '';
  const expiry = value.split('.')[0];
  if (!/^\d+$/.test(expiry) || Number(expiry) <= Date.now() / 1000 ||
      !equal(value, cookieValue(expiry, password))) {
    return json({ error: 'Entre no sistema para continuar.' }, 401);
  }
  return null;
}

export async function login(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return json({ error: 'Configure APP_PASSWORD na Netlify.' }, 503);
  if (!fromSameSite(request)) return json({ error: 'Origem inválida.' }, 403);
  const form = await request.formData().catch(() => null);
  const supplied = form?.get('senha');
  if (typeof supplied !== 'string' || !equal(supplied, password)) {
    return redirect('/?erro=senha');
  }

  const expiry = Math.floor(Date.now() / 1000) + durationSeconds;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return redirect('/controle-producao.html',
    `${cookieName}=${cookieValue(expiry, password)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${durationSeconds}${secure}`);
}

export function redirect(path, cookie) {
  const headers = { Location: path, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}
