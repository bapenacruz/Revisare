# syntax=docker/dockerfile:1

# ── Stage 1: install all deps (dev + prod) ───────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate Prisma client for Linux (generated/ is pure TS — always safe)
RUN npx prisma generate

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Railway automatically passes service variables as Docker build args.
ARG NEXT_PUBLIC_ABLY_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_ABLY_KEY=$NEXT_PUBLIC_ABLY_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Placeholder server-only vars so `next build` doesn't crash.
# Pages are server-rendered at request time, so no real DB connection is made here.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost/placeholder?sslmode=disable"
ENV AUTH_SECRET="build-placeholder"

RUN npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy production node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema + migrations (needed for `prisma migrate deploy` at startup)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy generated Prisma client
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated

# Copy Next.js config
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs
EXPOSE 3000

# Apply pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start"]
