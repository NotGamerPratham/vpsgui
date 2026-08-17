# Stage 1: Build the frontend bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# VITE_API_BASE_URL is intentionally not set: the client derives ${window.location.origin}/api/v1,
# which nginx proxies to the agent. Vite inlines env vars at build time, so setting them as runtime
# `environment:` entries in docker-compose (as this project previously did) has no effect at all.
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Drop the default vhost so it cannot shadow ours.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /var/www/vpsgui/dist
COPY deploy/nginx.conf /etc/nginx/conf.d/vpsgui.conf

# nginx.conf proxies /api/v1/ to 127.0.0.1:46509. Inside a container that is the container's own
# loopback, not the host, so the agent would be unreachable. `network_mode: host` in
# docker-compose.yml (or --network host) makes 127.0.0.1 resolve to the host where the agent runs.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
