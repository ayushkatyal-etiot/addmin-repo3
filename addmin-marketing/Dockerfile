# Static build, served by nginx -- this site has no server-side code of its
# own (Step 10's tech decision: "near-zero JS," no auth, no dynamic data),
# so there's nothing here to run except serving pre-built HTML/CSS files.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# .dockerignore excludes .env (gitignored, dev-only) -- production's
# PUBLIC_APP_URL comes in as a build arg instead, e.g.
# `fly deploy --build-arg PUBLIC_APP_URL=https://addmin-client.fly.dev`.
# Astro/Vite resolve import.meta.env.PUBLIC_* at build time, so this must be
# set before `npm run build`, not at container runtime.
ARG PUBLIC_APP_URL
ENV PUBLIC_APP_URL=${PUBLIC_APP_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
