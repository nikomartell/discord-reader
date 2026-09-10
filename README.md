# Discord Reader

A Next.js app hosted on Vercel that receives Discord slash commands over HTTP, stores messages in Neon Postgres, and displays them on a public near-real-time website feed. An optional voice worker on Railway joins Discord voice channels and reads `/post` messages aloud.

## How It Works

1. A user runs `/post message:"Hello"` in Discord.
2. Discord sends a signed HTTP request to `/api/discord/interactions`.
3. The app verifies the signature, stores the message in Postgres, and replies ephemerally in Discord.
4. The website subscribes to `/api/messages/stream` and shows new messages within a few seconds.
5. Open tabs with **Enable read-aloud** turned on fetch ElevenLabs audio and play new messages aloud in each author's chosen voice.
6. With the voice worker running, `/join` puts the bot in a voice channel and `/post` messages are read aloud there too.

Slash commands use Discord's **Interactions Endpoint URL** (Vercel). Voice channel playback uses a separate **always-on worker** with a Discord Gateway connection (Railway).

## Prerequisites

- Node.js 20+
- A Discord account
- A Vercel account
- A Neon Postgres database (recommended via the Vercel Marketplace)
- Railway account (only for voice channel read-aloud)

## Discord Application Setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy the **Application ID** and **Public Key** from **General Information**.
3. Open the **Bot** tab, create a bot, and copy the **Bot Token**.
4. Under **Bot**, enable **Server Members Intent** is not required; enable privileged intents only if needed. For voice, enable **Gateway** intents: `GUILDS`, `GUILD_VOICE_STATES` (under Bot → Privileged Gateway Intents, voice states are not privileged in newer API — verify in portal).
5. In **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`. Bot permissions: `Connect`, `Speak`, `Use Voice Activity`. Invite the bot to your test server.
6. After deploying this app, set **Interactions Endpoint URL** to:
   `https://<your-vercel-domain>/api/discord/interactions`

For local development, expose your dev server with a tunnel such as ngrok:

```bash
ngrok http 3000
```

Then point Discord at `https://<ngrok-url>/api/discord/interactions`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DISCORD_APP_ID` | Discord application ID |
| `DISCORD_PUBLIC_KEY` | Discord application public key |
| `DISCORD_BOT_TOKEN` | Discord bot token (command registration + voice worker) |
| `DATABASE_URL` | Neon Postgres connection string |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for server-side TTS |
| `ELEVENLABS_DEFAULT_VOICE_ID` | Default ElevenLabs voice for authors without a preference |
| `ELEVENLABS_DEFAULT_VOICE_NAME` | Optional display name for the default voice |
| `ELEVENLABS_MODEL_ID` | Optional ElevenLabs model (default: `eleven_turbo_v2_5`) |
| `VOICE_WORKER_URL` | Public URL of the Railway voice worker (Vercel only) |
| `VOICE_WORKER_SECRET` | Shared secret for Vercel ↔ worker auth (both services) |

Voice worker (Railway) also needs: `DISCORD_BOT_TOKEN`, `DATABASE_URL`, `VERCEL_URL`, `VOICE_WORKER_SECRET`, `PORT` (default `3100`).

If you use Vercel Marketplace for Neon:

```bash
vercel integration add neon
vercel env pull .env.local --yes
```

## Local Development

Install dependencies:

```bash
npm install
cd voice-worker && npm install && cd ..
```

Push the database schema:

```bash
npm run db:push
```

Register slash commands:

```bash
# Guild commands update instantly during development
npm run register-commands -- --guild=YOUR_GUILD_ID

# Global commands for production
npm run register-commands
```

Start the app:

```bash
npm run dev
```

Start the voice worker (optional, for `/join` testing):

```bash
# Set VERCEL_URL, VOICE_WORKER_SECRET, DISCORD_BOT_TOKEN, DATABASE_URL in voice-worker/.env or shell
npm run voice-worker:dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add the Discord and ElevenLabs environment variables in the Vercel dashboard.
4. Add `VOICE_WORKER_URL` and `VOICE_WORKER_SECRET` after deploying the voice worker.
5. Add Neon via the Vercel Marketplace if you have not already.
6. Deploy the app.
7. Set the Discord Interactions Endpoint URL to your production domain.
8. Register commands globally:

```bash
npm run register-commands
```

## Deploy Voice Worker to Railway

1. Create a new Railway project from this repository.
2. Set the service **Root Directory** to `voice-worker`.
3. Railway builds from `voice-worker/Dockerfile` (includes ffmpeg).
4. Add environment variables:
   - `DISCORD_BOT_TOKEN`
   - `DATABASE_URL` (same Neon database as Vercel)
   - `VERCEL_URL` (e.g. `https://your-app.vercel.app`)
   - `VOICE_WORKER_SECRET` (generate a random string; use the same value on Vercel)
   - `PORT` (Railway sets this automatically; default `3100` locally)
5. Deploy and copy the public Railway URL into Vercel's `VOICE_WORKER_URL`.
6. Re-invite the bot if needed with `Connect` and `Speak` permissions.

Health check: `GET /health` on the worker returns `{ "ok": true }`.

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/discord/interactions` | POST | Discord webhook for slash commands |
| `/api/messages` | GET | Paginated public message feed |
| `/api/messages/stream` | GET | Server-Sent Events stream for live updates |
| `/api/tts/[messageId]` | GET | ElevenLabs audio for a stored message |

## Slash Commands

```
/post message:<text>
```

Posts a message to the public website feed. The Discord confirmation is ephemeral, so only the poster sees it in Discord. If the voice worker is connected in that guild, the message is also read aloud in the voice channel.

```
/join [channel:<voice channel>]
```

Joins a voice channel and enables read-aloud for `/post` messages in that server. If no channel is given, joins your current voice channel. Uses a deferred response and sends a follow-up when join completes.

```
/leave
```

Leaves the voice channel and stops voice read-aloud for that server.

```
/setvoice voice:<search>
```

Sets the ElevenLabs voice used when your messages are read aloud on the website and in voice channels. Use autocomplete to search available voices.

```
/voice
```

Shows your current read-aloud voice preference, or reports that you are using the default voice.

## Read-Aloud

### Website

1. Open the website and click **Enable read-aloud** once per browser session.
2. When a new message arrives over SSE, the browser requests `/api/tts/{messageId}` and plays the audio.
3. Each Discord author can choose a different voice with `/setvoice`.
4. Authors who have never run `/setvoice` use `ELEVENLABS_DEFAULT_VOICE_ID`.

### Voice channels

1. Run `/join` in a server (optionally pick a voice channel).
2. Run `/post` — the bot fetches TTS from Vercel and plays it in the voice channel.
3. Run `/leave` when finished.

If the HTTP notify to the worker fails, the worker's database poller picks up new messages within a few seconds.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build for production |
| `npm run db:push` | Push Drizzle schema to Postgres |
| `npm run register-commands` | Register Discord slash commands |
| `npm run voice-worker:dev` | Start the voice worker locally |
