# ai-tools

Dashboard interne Pharmercure: React + Hono + Cloudflare D1, un solo Worker.

- Ogni dashboard è in `src/apps/<nome>/` (frontend `web/`, backend `api/`).
- Le migrazioni D1 sono in `migrations/`.
- L'indice di tutte le dashboard è alla radice (`/`).
- Per sviluppare con Claude Code, le regole sono nelle skill in `.claude/skills/`.

```bash
npm install
npm run db:migrate:local
npm run dev
```
