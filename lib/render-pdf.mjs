import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

const chromiumVersion = '153.0.0';
const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
const chromiumPack = `https://github.com/Sparticuz/chromium/releases/download/v${chromiumVersion}/chromium-v${chromiumVersion}-pack.${architecture}.tar`;

export async function renderPdf(html) {
  const installedBrowser = process.env.PDF_BROWSER_PATH;
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    executablePath: installedBrowser || await chromium.executablePath(chromiumPack),
    args: installedBrowser ? [] : chromium.args,
    headless: installedBrowser ? true : 'shell',
    timeout: 15000
  });

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const action = request.url().startsWith('data:') ? request.continue() : request.abort();
      void action.catch(() => {});
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 10000 });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: 15000 });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
