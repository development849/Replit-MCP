# Replit MCP Server (HTTP fork)

Remote-callable MCP server that gives an LLM agent control of your Replit account: list/create/fork/delete repls, read/write files, manage secrets, run/stop and deploy.

Forked from [NOVA-3951/Replit-MCP](https://github.com/NOVA-3951/Replit-MCP) (stdio). This fork adds:

- Streamable HTTP transport (Cowork / remote agents can call it)
- Bearer-token auth in front of `/mcp`
- `/health` liveness endpoint
- Module-level active-repl state that survives across stateless HTTP requests
- Replit Reserved VM Deployment config

## Tools

24 tools across users, repls, files, secrets, and deployments. See `src/server-factory.ts` for the full list.

## Authentication model

Two layers:

1. **Caller → MCP server:** `Authorization: Bearer $MCP_BEARER_TOKEN` on every `/mcp` request.
2. **MCP server → Replit:** the server holds your `connect.sid` cookie in `REPLIT_TOKEN` and uses it against `replit.com/graphql`.

> **Trust note.** `connect.sid` is your full Replit session cookie — anyone who reads it owns your account until you log out everywhere. Keep `REPLIT_TOKEN` only as a Replit Secret on the deployment, never in the repo, and rotate it (log out → log back in) if you suspect exposure.

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `REPLIT_TOKEN` | yes | Your Replit `connect.sid` cookie (DevTools → Application → Cookies → `replit.com`) |
| `MCP_BEARER_TOKEN` | yes | A long random string you pick. Callers must send it as `Authorization: Bearer …` |
| `PORT` | no | Defaults to 3000. Replit injects this automatically on Deployments |

## Deploy on Replit (Reserved VM)

1. Create a new Repl from this GitHub repo (`+ Create Repl` → `Import from GitHub`).
2. In **Secrets** (lock icon), add `REPLIT_TOKEN` and `MCP_BEARER_TOKEN`.
3. Click **Deploy** → **Reserved VM** → defaults are fine. Wait for the public URL.
4. Smoke test:
   ```
   curl https://<your-deployment>.replit.app/health
   ```

## Local development

```
npm install
MCP_BEARER_TOKEN=dev-token REPLIT_TOKEN=<your-cookie> npm run dev
curl localhost:3000/health
```

## Wiring into Cowork (Claude Code)

Cowork accepts custom remote MCP servers. Use the URL `https://<deployment>.replit.app/mcp` and add an `Authorization` header `Bearer <MCP_BEARER_TOKEN>`. After connecting, the 24 Replit tools become available to any Cowork session.

## License

MIT — same as the upstream repo's `package.json` declaration. A LICENSE file has been added to this fork.
