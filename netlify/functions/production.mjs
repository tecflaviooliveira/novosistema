import { getStore } from '@netlify/blobs';
import { snapshot } from '../../lib/production.cjs';
import { authorize, json, login } from '../../lib/netlify-session.mjs';

const dataKey = 'dados';

async function readEntry(store) {
  const entry = await store.getWithMetadata(dataKey, { type: 'json' });
  if (!entry || entry.etag) return entry;

  // Netlify Dev exposes the ETag in list() even when GET omits it.
  const { blobs } = await store.list({ prefix: dataKey });
  const etag = blobs.find(({ key }) => key === dataKey)?.etag;
  if (!etag) throw new Error('Armazenamento sem revisão para os dados existentes.');
  const current = await store.getWithMetadata(dataKey, { type: 'json' });
  return current && { data: current.data, etag: current.etag || etag };
}

export default async function handler(request) {
  const route = new URL(request.url).pathname;
  if (route === '/api/health' && request.method === 'GET') return json({ ok: true });
  if (route === '/api/login' && request.method === 'POST') return login(request);
  if (route !== '/api/data') return json({ error: 'Rota ou método inválido.' }, 404);

  const denied = authorize(request);
  if (denied) return denied;

  try {
    const store = getStore({ name: 'controle-producao', consistency: 'strong' });
    if (request.method === 'GET') {
      const entry = await readEntry(store);
      return json({ ...snapshot(entry?.data), revision: entry?.etag || 'empty' });
    }
    if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);

    const input = await request.json().catch(() => null);
    if (!Array.isArray(input?.records)) {
      return json({ error: 'O campo "records" deve ser um array.' }, 400);
    }
    const revision = request.headers.get('if-match');
    if (!revision) return json({ error: 'Carregue a versão atual dos dados antes de salvar.' }, 428);

    const entry = await readEntry(store);
    const writeId = typeof input.writeId === 'string' && /^[a-f0-9-]{36}$/i.test(input.writeId)
      ? input.writeId : null;
    if (writeId && writeId === entry?.data?.writeId) {
      return json({ ok: true, revision: entry.etag });
    }
    if ((entry?.etag || 'empty') !== revision) return conflict();
    const data = { ...snapshot(input, entry?.data), writeId, updatedAt: new Date().toISOString() };
    const result = await store.setJSON(dataKey, data,
      entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
    if (!result.modified) return conflict();
    return json({ ok: true, revision: result.etag });
  } catch (error) {
    console.error('Erro no armazenamento de produção:', error.message);
    return json({ error: 'Falha ao acessar os dados na nuvem.' }, 500);
  }
}

function conflict() {
  return json({ error: 'Os dados na nuvem foram alterados em outra sessão.' }, 409);
}

export const config = { path: ['/api/health', '/api/login', '/api/data'], preferStatic: false };
