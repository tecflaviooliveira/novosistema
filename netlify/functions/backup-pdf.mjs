import { getStore } from '@netlify/blobs';
import { backupListing, pdfFilename } from '../../lib/backups.cjs';
import { authorize, json, redirect } from '../../lib/netlify-session.mjs';
import { renderPdf } from '../../lib/render-pdf.mjs';

export default async function handler(request) {
  const denied = authorize(request);
  if (denied) {
    return denied.status === 401 && request.method === 'GET' ? redirect('/') : denied;
  }

  try {
    const store = getStore({ name: 'controle-producao-pdfs', consistency: 'strong' });
    if (request.method === 'GET') {
      const filename = new URL(request.url).searchParams.get('arquivo');
      if (filename === null) {
        const { blobs } = await store.list();
        return new Response(backupListing(blobs.map(({ key }) => key)), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
      if (!/^[\w.-]+\.pdf$/.test(filename)) return json({ error: 'Arquivo inválido.' }, 400);
      const file = await store.get(filename, { type: 'stream' });
      if (!file) return json({ error: 'PDF não encontrado.' }, 404);
      return new Response(file, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        }
      });
    }
    if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);

    const input = await request.json().catch(() => null);
    if (typeof input?.html !== 'string' || !input.html || typeof input?.filename !== 'string' || !input.filename) {
      return json({ error: 'html e filename são obrigatórios.' }, 400);
    }
    const filename = pdfFilename(input.filename);
    await store.set(filename, await renderPdf(input.html));
    return json({ ok: true, filename, url: '/api/backup-pdf?arquivo=' + encodeURIComponent(filename) });
  } catch (error) {
    console.error('Erro no backup PDF:', error.message);
    return json({ error: 'Não foi possível acessar ou gerar o backup PDF.' }, 500);
  }
}

export const config = { path: '/api/backup-pdf', preferStatic: false };
