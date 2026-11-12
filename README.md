# Painel de Acompanhamento de Matrículas (TV + Admin)

Painel web para ficar ligado em uma TV, no lugar da apresentação em PowerPoint, com
transições e animações. Um painel administrativo recebe as planilhas e atualiza a TV.

- **`/`**: apresentação para a TV (tela cheia 16:9, troca automática de slides)
- **`/admin`**: envio das planilhas, metas e configurações (protegido por senha)

## Como funciona

1. No `/admin`, arraste as planilhas exportadas do sistema:
   - **Relatório de Acompanhamento de Rematrícula** (.xls): gera Captação (`Tipo Aluno = Novo`),
     Rematrícula (`Tipo Aluno = Antigo`), captação por mês (`Data Matrícula`) e rematrícula por
     segmento (`Curso`/`Série`)
   - **Relação de Alunos_NAC** (.xls)
   - **Relação de Alunos_Integral** (.xls)
2. Confira os números, ajuste as metas se precisar e clique em **Publicar na TV**.
3. A TV busca os dados novos a cada minuto e atualiza sozinha.

**Privacidade:** as planilhas são lidas no navegador de quem está no admin. Só os totais
(números) são enviados ao servidor. Nenhum nome, telefone, e-mail ou endereço de aluno é armazenado.

## Publicar na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório do GitHub (o framework
   Next.js é detectado sozinho).
2. Em **Settings → Environment Variables**, crie:
   - `ADMIN_PASSWORD`: senha de acesso ao `/admin`
   - `SESSION_SECRET`: uma string longa e aleatória
3. Na aba **Storage**, crie um **Blob** store (público ou privado) e conecte ao projeto
   (Production e Preview). A Vercel cria `BLOB_STORE_ID` (OIDC) ou `BLOB_READ_WRITE_TOKEN`
   automaticamente; os dois funcionam. É lá que os dados publicados ficam guardados.
4. Faça **Redeploy** para aplicar as variáveis.
5. Acesse `https://seu-projeto.vercel.app/admin`, entre com a senha e envie as planilhas.

## Na TV

- Abra `https://seu-projeto.vercel.app/` no navegador da TV (ou num Chromecast/Fire TV Stick/mini PC).
- Pressione **F** ou mexa o mouse e clique em **Tela cheia**.
- Teclas: `→`/`←` trocam o slide, `espaço` pausa.
- A página pede para a tela não apagar (Wake Lock) e se recarrega sozinha a cada ~6 h.

## Rodar localmente

```bash
npm install
```

```bash
ADMIN_PASSWORD=teste npm run dev
```

Sem `BLOB_READ_WRITE_TOKEN`, os dados ficam em `.data/state.json`.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `lib/parse.ts` | Leitura das planilhas (no navegador) |
| `lib/view.ts` | Cálculo de percentuais, faltas e metas mensais |
| `lib/storage.ts` | Persistência (Vercel Blob ou arquivo local) |
| `components/tv/` | Slides, transições e animações |
| `components/admin/` | Painel administrativo |
