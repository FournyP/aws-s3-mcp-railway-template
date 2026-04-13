ARG AWS_S3_MCP_VERSION=v0.4.0

FROM node:20-alpine AS builder

RUN apk add --no-cache git python3 make g++

WORKDIR /src

ARG AWS_S3_MCP_VERSION
RUN git clone --depth 1 --branch ${AWS_S3_MCP_VERSION} https://github.com/samuraikun/aws-s3-mcp.git .

RUN npm ci --ignore-scripts && npm run build


FROM node:20-alpine

WORKDIR /app

RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

COPY --from=builder /src/package.json /src/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /src/dist ./dist

USER nodeuser

EXPOSE 3000

CMD ["node", "dist/index.js", "--http"]
