# AWS S3 MCP Railway Template

Deploys [aws-s3-mcp](https://github.com/samuraikun/aws-s3-mcp) behind an nginx bearer-token auth gateway.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aws-s3-mcp?referralCode=C3Uv6n&utm_medium=integration&utm_source=template&utm_campaign=generic)

## 🏗️ Architecture

```
client ──Authorization: Bearer <key>──► aws-s3-mcp-gateway (nginx, public)
                                              │
                                              ▼ private network
                                    aws-s3-mcp (private) ──► S3
```

Two Railway services:

- **`aws-s3-mcp-gateway`** — `nginx:1.29.8-alpine`, exposes a public domain, validates the `Authorization: Bearer <key>` header against `API_KEYS`, and forwards to the mcp service via Railway's private network.
- **`aws-s3-mcp`** — builds [samuraikun/aws-s3-mcp](https://github.com/samuraikun/aws-s3-mcp) from source at tag `v0.4.0`. **Do not give this service a public domain**; it is only reachable at `aws-s3-mcp.railway.internal:3000`.

## ✨ Features

- Bearer-token auth with a comma-separated allowlist of keys
- SSE / streamable HTTP passthrough (`/sse`, `/mcp`)
- Unauthenticated `/health` (and `/healthz`) on the gateway for Railway healthchecks
- Optional keyed-path entrypoint for MCP clients that cannot send an `Authorization` header
- Gateway is plain nginx; mcp is the upstream project built from source at a pinned tag

## 💁‍♀️ How to use

1. Click the Railway button 👆
2. Fill in the variables (see [`.env.example`](./.env.example))
3. Deploy! 🚄
4. Point your MCP client at `https://<gateway-domain>/mcp` (streamable-HTTP, `"type": "http"`) with header `Authorization: Bearer <your-key>`. Quick check:
   ```bash
   curl -sS -X POST https://<gateway-domain>/mcp \
     -H "Authorization: Bearer <your-key>" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
   ```
   With Claude Code:
   ```bash
   claude mcp add aws-s3 --transport http https://<gateway-domain>/mcp \
     --header "Authorization: Bearer <your-key>"
   ```

## 🧱 Infrastructure as Code

`.railway/railway.ts` defines the whole project — both services and every variable.

```bash
railway link
npm install

# First apply only; later runs omit these and preserve() keeps the values.
export API_KEYS=$(openssl rand -hex 32)
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
export S3_BUCKETS=my-bucket,other-bucket

npm run plan     # read the diff before applying
npm run apply
railway domain --service aws-s3-mcp-gateway
```

Give the domain to the gateway only. `aws-s3-mcp` has no authentication of its own and
must stay private.

Needs the Railway CLI 5.42.1 or newer: the IaC engine ships in the CLI, not in the npm
package. If you forked this repo, change `REPO` in `railway.ts` to your own before applying.

Link it to a project dedicated to this template. An apply deletes every resource **and
every variable** the file does not declare, so from then on variables live in `railway.ts`,
not the dashboard. Do not point it at a project created from the deploy button — the
service names differ, and a mismatch is a delete and recreate, not a rename.

## ⬆️ Upgrading

Railway template updates are opt-in — an existing deployment keeps running until you apply the update. See the [changelog](CHANGELOG.md) for what each update contains.

## 🔧 Variables

### Gateway service

| Variable | Required | Description |
| --- | --- | --- |
| `API_KEYS` | yes | Comma-separated list of allowed bearer tokens. Allowed chars per key: `A-Z a-z 0-9 . _ ~ + / = -` |
| `MCP_HOST` | no | Defaults to `aws-s3-mcp.railway.internal`. Only override if you rename the mcp service. |
| `MCP_PORT` | no | Defaults to `3000`. |
| `PATH_KEY_AUTH` | no | `true` enables the keyed-path entrypoint (see below). Default `false`. |

### MCP service

| Variable | Required | Description |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | yes | Access key for your S3-compatible storage. For Railway's built-in bucket, reference the bucket's `AWS_ACCESS_KEY_ID`. |
| `AWS_SECRET_ACCESS_KEY` | yes | Secret for your S3-compatible storage. For Railway's built-in bucket, reference the bucket's `AWS_SECRET_ACCESS_KEY`. |
| `S3_BUCKETS` | yes | Comma-separated allowlist of bucket names the MCP is permitted to touch. For Railway's built-in bucket, reference the bucket's `AWS_S3_BUCKET_NAME`. The server starts without it but exposes no buckets. |
| `AWS_ENDPOINT` | no | S3 endpoint URL. For Railway's built-in bucket, reference the bucket's `AWS_ENDPOINT_URL`. For real AWS, leave empty. |
| `AWS_REGION` | no | Region of the target buckets. For Railway's built-in bucket, reference the bucket's `AWS_DEFAULT_REGION` (`auto`). For real AWS, use `us-east-1`/`eu-west-3`/etc. |
| `S3_MAX_BUCKETS` | no | Maximum number of buckets to list (default `5`) |
| `PORT` | no | Defaults to `3000`. Railway injects this. |

## 🔑 Keyed-path entrypoint (opt-in)

Some MCP clients enumerate a server's tools before they have anywhere to store a
credential, so their discovery request arrives with no `Authorization` header and
takes a `401`. Setting `PATH_KEY_AUTH=true` on the gateway adds a second way in:

```
https://<gateway-domain>/k/<your-key>/mcp
```

The key is validated against the same `API_KEYS` allowlist. An absent or wrong
key is still `401`, and a valid key unlocks nothing but `/mcp` — the key segment
is stripped before proxying, so the mcp service only ever sees `/mcp`.

**The key travels in the URL**, where it can be recorded by edge and proxy logs
outside your control (the gateway itself logs nothing for this path). So:

- Issue a **separate key** in `API_KEYS` for each client that uses this path, so
  it can be rotated without touching the others.
- Leave `PATH_KEY_AUTH` off and use the header form everywhere else.
- Keys used on this path may not contain `/` (the header form allows it), since
  a slash would split the path segment.

## 📝 Notes

- **Generate strong keys:** `openssl rand -hex 32`
- **Rotating a key:** update `API_KEYS` on the gateway service and redeploy it. The mcp service is untouched.
- **`/health` and `/healthz` are unauthenticated** so Railway (and any uptime monitor) can probe without a token. Everything else requires `Authorization: Bearer <key>`.
- **Invalid / missing token:** the gateway returns `401` with a `WWW-Authenticate: Bearer realm="aws-s3-mcp"` header.
- **Do not expose the mcp service publicly.** All traffic should enter through the gateway.
- **Gateway port:** nginx listens on `PORT`, which the IaC file pins to `80`. Railway injects a random `PORT` when the variable is unset, so if you create the gateway by hand and give its domain an explicit target port, set `PORT` to match or the edge gets `connection refused`.
- Upstream repo: https://github.com/samuraikun/aws-s3-mcp

## ⚖️ License

[MIT](LICENSE)
