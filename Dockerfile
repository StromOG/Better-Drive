# ==========================================
# BetterDrive Production Container
# Multi-stage build with minimal attack surface
# ==========================================

# 1. Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --prefer-offline --no-audit
COPY frontend/ ./
RUN npm run build

# 2. Backend Build Stage
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install --workspace backend --prefer-offline --no-audit
COPY backend/ ./backend/
RUN cd backend && npm run build && npx prisma generate

# 3. Production Runtime Stage
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV SFTP_PORT=2222

COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/scripts ./backend/scripts
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000 2222
VOLUME ["/app/data"]

ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
