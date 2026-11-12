function pdfFilename(name) {
  return String(name).slice(0, 180).replace(/[^\w.-]/g, '_') + '.pdf';
}

function backupListing(filenames) {
  const links = filenames
    .filter((name) => /^[\w.-]+\.pdf$/.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map((name) => `<li><a href="/api/backup-pdf?arquivo=${encodeURIComponent(name)}">${name}</a></li>`);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Backups PDF</title>
    <style>body{font:16px system-ui;max-width:54rem;margin:2rem auto;padding:0 1rem}li{margin:.6rem 0;overflow-wrap:anywhere}</style>
    </head><body><a href="/controle-producao.html">Voltar ao cadastro</a><h1>Backups PDF</h1>
    ${links.length ? '<ul>' + links.join('') + '</ul>' : '<p>Nenhum backup PDF disponível.</p>'}</body></html>`;
}

module.exports = { backupListing, pdfFilename };
