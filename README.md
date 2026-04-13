# AWS S3 MCP Railway Template

Deploys [aws-s3-mcp](https://github.com/samuraikun/aws-s3-mcp) behind an nginx bearer-token auth gateway.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aws-s3-mcp?referralCode=C3Uv6n&utm_medium=integration&utm_source=template&utm_campaign=generic)

## 🏗️ Architecture

```
client ──Authorization: Bearer <key>──► gateway (nginx, public)
                                              │
                                              ▼ private network
                                        mcp (aws-s3-mcp, private) ──► S3
```

Two Railway services:

- **`gateway`** — `nginx:alpine`, exposes a public domain, validates the `Authorization: Bearer <key>` header against `API_KEYS`, and forwards to the mcp service via Railway's private network.
- **`mcp`** — builds [samuraikun/aws-s3-mcp](https://github.com/samuraikun/aws-s3-mcp) from source at tag `v0.4.0`. **Do not give this service a public domain**; it is only reachable at `mcp.railway.internal:3000`.

## ✨ Features

- Bearer-token auth with a comma-separated allowlist of keys
- SSE / streamable HTTP passthrough (`/sse`, `/mcp`)
- Unauthenticated `/health` passthrough for Railway healthchecks
- Gateway is plain nginx; mcp is the upstream project built from source at a pinned tag

## 💁‍♀️ How to use

1. Click the Railway button 👆
2. Fill in the variables (see [`.env.example`](./.env.example))
3. Deploy! 🚄
4. Call the gateway:
   ```
   curl -H "Authorization: Bearer <your-key>" https://<gateway-domain>/mcp
   ```

## 🔧 Variables

### Gateway service

| Variable | Required | Description |
| --- | --- | --- |
| `API_KEYS` | yes | Comma-separated list of allowed bearer tokens. Allowed chars per key: `A-Z a-z 0-9 . _ ~ + / = -` |
| `MCP_HOST` | no | Defaults to `mcp.railway.internal`. Only override if you rename the mcp service. |
| `MCP_PORT` | no | Defaults to `3000`. |

### MCP service

| Variable | Required | Description |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | yes | Access key for your S3-compatible storage. For Railway's built-in bucket, reference the bucket's `AWS_ACCESS_KEY_ID`. |
| `AWS_SECRET_ACCESS_KEY` | yes | Secret for your S3-compatible storage. For Railway's built-in bucket, reference the bucket's `AWS_SECRET_ACCESS_KEY`. |
| `S3_BUCKETS` | yes | Comma-separated allowlist of bucket names the MCP is permitted to touch. For Railway's built-in bucket, reference the bucket's `AWS_S3_BUCKET_NAME`. If empty, no buckets are exposed. |
| `AWS_ENDPOINT` | no | S3 endpoint URL. For Railway's built-in bucket, reference the bucket's `AWS_ENDPOINT_URL`. For real AWS, leave empty. |
| `AWS_REGION` | no | Region of the target buckets. For Railway's built-in bucket, reference the bucket's `AWS_DEFAULT_REGION` (`auto`). For real AWS, use `us-east-1`/`eu-west-3`/etc. |
| `S3_MAX_BUCKETS` | no | Maximum number of buckets to list (default `5`) |

## 📝 Notes

- **Generate strong keys:** `openssl rand -hex 32`
- **Rotating a key:** update `API_KEYS` on the gateway service and redeploy it. The mcp service is untouched.
- **`/health` is unauthenticated** so Railway (and any uptime monitor) can probe without a token. Everything else requires `Authorization: Bearer <key>`.
- **Invalid / missing token:** the gateway returns `401` with a `WWW-Authenticate: Bearer realm="aws-s3-mcp"` header.
- **Do not expose the mcp service publicly.** All traffic should enter through the gateway.
- Upstream repo: https://github.com/samuraikun/aws-s3-mcp
