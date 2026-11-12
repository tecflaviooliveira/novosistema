import { copyFile, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const page of ['index.html', 'controle-producao.html', 'relatorio-producao.html']) {
  await copyFile(new URL('../' + page, import.meta.url), new URL(page, output));
}
