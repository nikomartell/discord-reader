# Discord Reader

A Next.js app hosted on Vercel that receives Discord slash commands over HTTP, stores messages in Neon Postgres, and displays them on a public near-real-time website feed.

## How It Works

1. A user runs `/post message:"Hello"` in Discord.
2. Discord sends a signed HTTP request to `/api/discord/interactions`.
3. The app verifies the signature, stores the message in Postgres, and replies ephemerally in Discord.
4. The website subscribes to `/api/messages/stream` and shows new messages within a few seconds.

This project uses Discord's **Interactions Endpoint URL** instead of a persistent Gateway WebSocket, which makes it compatible with Vercel serverless functions.

## Prerequisites

- Node.js 20+
- A Discord account
- A Vercel account
- A Neon Postgres database (recommended via the Vercel Marketplace)

## Discord Application Setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy the **Application ID** and **Public Key** from **General Information**.
3. Open the **Bot** tab, create a bot, and copy the **Bot Token**.
4. In **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`, then invite the bot to your test server.
5. After deploying this app, set **Interactions Endpoint URL** to:
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
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DATABASE_URL` | Neon Postgres connection string |

If you use Vercel Marketplace for Neon:

```bash
vercel integration add neon
vercel env pull .env.local --yes
```

## Local Development

Install dependencies:

```bash
npm install
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

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add the Discord environment variables in the Vercel dashboard.
4. Add Neon via the Vercel Marketplace if you have not already.
5. Deploy the app.
6. Set the Discord Interactions Endpoint URL to your production domain.
7. Register commands globally:

```bash
npm run register-commands
```

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/discord/interactions` | POST | Discord webhook for slash commands |
| `/api/messages` | GET | Paginated public message feed |
| `/api/messages/stream` | GET | Server-Sent Events stream for live updates |

## Slash Command

```
/post message:<text>
```

Posts a message to the public website feed. The Discord confirmation is ephemeral, so only the poster sees it in Discord.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build for production |
| `npm run db:push` | Push Drizzle schema to Postgres |
| `npm run register-commands` | Register Discord slash commands |
