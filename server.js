const express = require('express');
const { snapshot } = require('./lib/production.cjs');
const { backupListing, pdfFilename } = require('./lib/backups.cjs');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'backups');
const TEMP_DIR = path.join(ROOT, '.temp');
const DATA_FILE = path.join(ROOT, 'data.json');
const PORT = 3847;

const app = express();

app.use(express.json({ limit: '10mb' }));
for (const page of ['index.html', 'controle-producao.html', 'relatorio-producao.html']) {
  app.get(page === 'index.html' ? ['/', '/index.html'] : '/' + page, (req, res) => {
    res.sendFile(path.join(ROOT, page));
  });
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

// ── Persistência em arquivo local ────────────────────────────────────────────

app.get('/api/data', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ records: [], archivedRecords: [], monthlyReports: [], tecnico: '' });
    }
    res.json(snapshot(readJsonFile(DATA_FILE)));
  } catch (error) {
    res.status(500).json({ error: 'Falha ao ler os dados: ' + error.message });
  }
});

app.post('/api/data', (req, res) => {
  const { records, archivedRecords, tecnico } = req.body || {};

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'O campo "records" deve ser um array.' });
  }

  try {
    let existing = {};
    if (fs.existsSync(DATA_FILE)) {
      try {
        existing = readJsonFile(DATA_FILE);
      } catch {
        existing = {};
      }
    }

    const data = { ...snapshot({ records, archivedRecords, tecnico }, existing), updatedAt: new Date().toISOString() };
    const temporaryFile = DATA_FILE + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporaryFile, DATA_FILE);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao salvar os dados: ' + error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ── Backup PDF ────────────────────────────────────────────────────────────────

app.get('/api/backup-pdf', (req, res) => {
  const filename = req.query.arquivo;
  if (filename) {
    if (typeof filename !== 'string' || !/^[\w.-]+\.pdf$/.test(filename)) return res.sendStatus(400);
    return res.download(path.join(BACKUP_DIR, filename));
  }
  res.type('html').send(backupListing(fs.readdirSync(BACKUP_DIR)));
});

app.post('/api/backup-pdf', async (req, res) => {
  const { html, filename } = req.body || {};

  if (!html || !filename) {
    return res.status(400).json({ error: 'html e filename são obrigatórios.' });
  }

  const browser = findBrowser();
  if (!browser) {
    return res.status(500).json({ error: 'Edge ou Chrome não encontrado no computador.' });
  }

  ensureDir(BACKUP_DIR);
  ensureDir(TEMP_DIR);

  const safeName = pdfFilename(filename);
  const pdfPath = path.join(BACKUP_DIR, safeName);
  const htmlPath = path.join(TEMP_DIR, `backup-${Date.now()}.html`);

  try {
    fs.writeFileSync(htmlPath, html, 'utf8');

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

    await execFileAsync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        fileUrl
      ],
      { timeout: 45000 }
    );

    res.json({
      ok: true,
      filename: safeName,
      url: '/api/backup-pdf?arquivo=' + encodeURIComponent(safeName),
      path: pdfPath
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao gerar o PDF.' });
  } finally {
    try {
      fs.unlinkSync(htmlPath);
    } catch {
      // ignore temp cleanup errors
    }
  }
});

app.listen(PORT, () => {
  ensureDir(BACKUP_DIR);
  console.log(`Controle de Produção: http://localhost:${PORT}`);
  console.log(`Backups PDF em: ${BACKUP_DIR}`);
});
