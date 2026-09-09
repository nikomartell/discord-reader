<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- When executing an attached plan, do not edit the plan file; use existing todos and mark them in_progress/completed rather than recreating them
- Prefer Discord slash commands with autocomplete for in-Discord configuration (e.g. `/setvoice`) over website OAuth settings pages
- Use superpowers skills (especially using-superpowers) when planning or implementing features in this project
- Commit and push only when explicitly requested

## Learned Workspace Facts

- discord-reader is a Next.js App Router app on Vercel using Discord HTTP Interactions (not Gateway WebSocket) because serverless has no persistent process
- Data layer is Neon Postgres via Vercel Marketplace with Drizzle ORM and lazy `getDb()` initialization (no Proxy wrapper)
- Public website feed uses SSE (`GET /api/messages/stream`) polling Postgres every ~3s; no website auth
- Discord slash commands: `/post` (publish to feed), `/setvoice` (ElevenLabs voice autocomplete), `/voice` (show preference)
- ElevenLabs TTS is server-side only (`GET /api/tts/[messageId]`); browser read-aloud requires user to click Enable read-aloud
- Per-author voice preferences stored in `user_voice_preferences`; new authors use `ELEVENLABS_DEFAULT_VOICE_ID`
- Register slash commands with `npm run register-commands -- --guild=GUILD_ID` for dev (instant) or globally for production
- Git remote: github.com:nikomartell/discord-reader.git on `main`
