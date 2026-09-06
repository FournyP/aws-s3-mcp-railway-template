// Railway Infrastructure as Code: railway config plan | apply
//
// An apply deletes every resource this file does not declare, so link it to a
// project dedicated to this template.
//
// Secrets stay out of here. Export them for the first apply; later runs omit
// them and preserve() keeps what Railway holds.
//
//   export API_KEYS=$(openssl rand -hex 32)
//   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
//   export S3_BUCKETS=my-bucket,other-bucket AWS_REGION=us-east-1

import { defineRailway, github, preserve, project, service } from "railway/iac";

const REPO = "FournyP/aws-s3-mcp-railway-template";

// Matched by name, so keep these identical to Railway: a mismatch is a
// delete and recreate, not a rename.
const GATEWAY_SERVICE = "aws-s3-mcp-gateway";
const MCP_SERVICE = "aws-s3-mcp";

// The gateway needs this as a literal to build its upstream URL.
const MCP_PORT = "3000";

/** Push the value from the local environment if present, else keep Railway's. */
const fromEnvOrPreserve = (name: string) => process.env[name] ?? preserve();

export default defineRailway(() => {
  // No domain here: auth lives in the gateway, and this service has none.
  const mcp = service(MCP_SERVICE, {
    // Each service builds from its own directory; there is no root Dockerfile.
    source: github(REPO, { branch: "main", rootDirectory: "mcp" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    env: {
      // The port the upstream binds. Pinned rather than left to Railway, so the
      // gateway's MCP_PORT literal below cannot drift from it.
      PORT: "3000",

      AWS_ACCESS_KEY_ID: fromEnvOrPreserve("AWS_ACCESS_KEY_ID"),
      AWS_SECRET_ACCESS_KEY: fromEnvOrPreserve("AWS_SECRET_ACCESS_KEY"),
      AWS_REGION: fromEnvOrPreserve("AWS_REGION"),

      // Set to point at a non-AWS endpoint, such as a Railway Bucket.
      AWS_ENDPOINT: fromEnvOrPreserve("AWS_ENDPOINT"),

      // Bucket allowlist. Unset exposes nothing.
      S3_BUCKETS: fromEnvOrPreserve("S3_BUCKETS"),
      S3_MAX_BUCKETS: process.env.S3_MAX_BUCKETS ?? preserve(),
    },
  });

  const gateway = service(GATEWAY_SERVICE, {
    source: github(REPO, { branch: "main", rootDirectory: "gateway" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      // Proxied through unauthenticated, so it also checks the private hop.
      healthcheckPath: "/health",
    },
    env: {
      // Comma-separated bearer tokens. Per key: A-Z a-z 0-9 . _ ~ + / = -
      API_KEYS: fromEnvOrPreserve("API_KEYS"),

      MCP_HOST: mcp.env.RAILWAY_PRIVATE_DOMAIN,
      MCP_PORT,
    },
  });

  return project("AWS S3 MCP", { resources: [mcp, gateway] });
});
