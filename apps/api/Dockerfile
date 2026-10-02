# syntax=docker/dockerfile:1

# ---- deps: full install (dev+prod), generates the Prisma client via postinstall. bcrypt has a
# native binding with no prebuilt musl/alpine binary, so python3/make/g++ are needed to compile
# it from source. ----
FROM node:24-alpine AS deps
# 默认使用 npmmirror 镜像: 生产服务器在中国大陆, 直连 registry.npmjs.org / nodejs.org / binaries.prisma.sh
# 经常超时或中断。ENV 会被下游的 build / prod-deps 阶段继承。在可直连官方源的环境构建时可覆盖:
#   docker compose build --build-arg NPM_REGISTRY=https://registry.npmjs.org
#   (同理可覆盖 NODEJS_ORG_MIRROR=https://nodejs.org/dist 与 PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh)
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY NODEJS_ORG_MIRROR=$NODEJS_ORG_MIRROR PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs prisma/schema.prisma present.
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# ---- build: compile TypeScript. also used directly as the `prisma migrate deploy` runner via
# docker-compose's `migrate` service, since it still has the full devDependencies (including the
# prisma CLI) that `prod-deps` below strips out. ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod-deps: prune deps down to production-only IN PLACE (not a fresh `npm ci --omit=dev`),
# so the Prisma client generated in `deps` survives without needing the (dev-only) prisma CLI to
# regenerate it. ----
FROM deps AS prod-deps
RUN npm prune --omit=dev --legacy-peer-deps

# ---- runtime: no compilers, no devDependencies, no source - just the compiled app ----
FROM node:24-alpine AS runtime
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p uploads && chown -R app:app /app
USER app
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
