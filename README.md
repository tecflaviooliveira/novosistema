# Controle de Produção

O cadastro, a pesquisa, a edição e a exclusão de O.S., o relatório mensal, a impressão e os backups PDF funcionam na mesma URL. Na versão online, a tabela e o histórico ficam no Netlify Blobs. O acesso usa uma senha compartilhada pela equipe. O nome do técnico continua sendo informado no cadastro e aparece nas fichas.

## Publicar via GitHub e Netlify

1. Envie a cópia de código para um repositório novo no GitHub, com `netlify.toml` na raiz. Use um histórico Git novo. Mantenha o `data.json` e os backups no computador.
2. Na Netlify, escolha **Add new project → Import an existing project → GitHub** e selecione o repositório e a branch `main`.
3. Confira as configurações de `netlify.toml`. A pasta base é a raiz, o comando é `npm run build`, a pasta publicada é `dist` e as funções estão em `netlify/functions`. O build usa Node.js 24.
4. No painel da Netlify, crie a variável secreta `APP_PASSWORD` com uma senha longa e aleatória. Disponibilize-a para **Functions** no contexto **Production**. Se o primeiro deploy já tiver ocorrido, publique novamente após salvar a variável.
5. Faça a importação abaixo antes do primeiro login, se for levar o histórico local.

Para publicar manualmente pela CLI, use `npm ci`, `netlify login`, `netlify link` e `netlify deploy --build --prod`. A variável `APP_PASSWORD` usa a mesma configuração no painel.

## Migrar os dados do aplicativo local

O importador usa o `data.json` do servidor local e leva a tabela ativa, o histórico de O.S. e o nome do técnico. Os indicadores mensais são recalculados com base nas O.S. O importador só grava quando a base online está vazia.

No PowerShell, na pasta do código, use a mesma senha configurada na Netlify. Informe a URL de produção e o caminho do `data.json` que ficou no computador.

```powershell
$senha = Read-Host 'Senha de acesso ao sistema' -AsSecureString
$env:APP_PASSWORD = [System.Net.NetworkCredential]::new('', $senha).Password
node scripts/import-data.mjs https://seu-site.netlify.app 'C:\caminho\do\projeto-original\data.json'
Remove-Item Env:APP_PASSWORD
Remove-Variable senha
```

No site, entre com a senha, abra **Relatório** e confira os meses importados. Em **Backups PDF**, é possível baixar os arquivos gerados a partir do novo site. O backup diário é atualizado quando a tabela é usada. **Criar nova tabela** primeiro grava um PDF da tabela e depois arquiva as O.S.

## Executar no computador

- Modo local original no Windows. Execute `npm ci` e `npm start`. Abra `http://localhost:3847`. O servidor usa `data.json`, a pasta `backups` e o Chrome ou Edge do computador.
- Simulação da Netlify. Execute `npm run build`, defina uma `APP_PASSWORD` de teste no terminal e execute `netlify dev --offline`. No Windows, defina também `PDF_BROWSER_PATH` com o caminho do executável do Chrome ou Edge. Na Netlify, a função baixa uma versão fixa do Chromium na primeira execução da instância e reutiliza o binário nas chamadas seguintes.
