import { readFile } from 'node:fs/promises';

const [site, filename] = process.argv.slice(2);
const password = process.env.APP_PASSWORD;
if (!site || !filename || !password) {
  throw new Error('Uso: node scripts/import-data.mjs https://seu-site.netlify.app data.json (com APP_PASSWORD no ambiente)');
}

const origin = new URL(site);
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) {
  throw new Error('Use a URL HTTPS do site para enviar dados.');
}
const data = JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, ''));
if (!Array.isArray(data.records)) throw new Error('O arquivo precisa conter a lista "records".');

const login = await fetch(new URL('/api/login', origin), {
  method: 'POST',
  body: new URLSearchParams({ senha: password }),
  redirect: 'manual'
});
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie || login.status !== 303) throw new Error('Falha no login. Confira a senha e a configuração do site.');

const response = await fetch(new URL('/api/data', origin), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie, 'If-Match': 'empty' },
  body: JSON.stringify(data),
  redirect: 'error'
});
if (response.status === 409) throw new Error('O armazenamento já foi inicializado. A importação preservou os dados da nuvem.');
if (!response.ok) throw new Error('Falha na importação. Código HTTP ' + response.status);

const loaded = await fetch(new URL('/api/data', origin), { headers: { Cookie: cookie }, redirect: 'error' });
if (!loaded.ok) throw new Error('A gravação foi aceita, mas a verificação da leitura falhou.');
const imported = await loaded.json();
if (imported.records.length !== data.records.length) throw new Error('A contagem de registros importados divergiu da origem.');
console.log(`Importação concluída. ${imported.records.length} O.S. na tabela e ${imported.archivedRecords.length} no histórico consolidado.`);
