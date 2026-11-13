# Campeonato de Tênis

Página única com **Classificação** (ordenável, com últimas 5 partidas) e **Jogos** (do mais novo ao mais antigo, ordenável).
Clicar em um jogador do ranking filtra os jogos dele; clicar em outro troca o filtro; clicar no mesmo remove.
Admins entram pelo botão **Admin**, lançam placares (`6x2 3x6 10x8` ou WO) e gerenciam jogadores.

## Regras
- Vitória = 5 pts · Derrota = 2 pts · WO (quem não compareceu) = 0 pts
- Desempate: mais pontos → mais vitórias → mais sets ganhos → menos WO concedidos
- Um confronto só pode ser lançado uma vez (o banco também garante isso)

## Publicar na Vercel (custo zero)

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project** → importe o repositório (plano **Hobby**).
3. No projeto, aba **Storage → Create Database → Neon (Postgres)** → plano **Free** → conecte ao projeto.
   A Vercel cria a variável `DATABASE_URL` sozinha.
4. Em **Settings → Environment Variables**, crie `ADMIN_PASSWORD` com a senha dos admins.
5. Faça o **Deploy** (ou *Redeploy* se já tinha feito).

Na primeira visita o app cria as tabelas e cadastra os 22 jogadores da planilha automaticamente.

> O plano Hobby da Vercel é só para uso pessoal/não comercial.

## Rodar localmente
```bash
cp .env.example .env.local   # preencha DATABASE_URL e ADMIN_PASSWORD
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes das regras
```

## Estrutura
- `lib/score.ts` – leitura/validação do placar · `lib/stats.ts` – pontos, desempate, últimos 5
- `lib/db.ts` – Postgres (cria tabelas e cadastra os jogadores iniciais na 1ª execução)
- `app/api/*` – rotas; as que alteram dados exigem login de admin
- `components/*` – tabelas e modais
