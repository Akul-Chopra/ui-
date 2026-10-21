# --- build stage ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install against the lockfile first so the dependency layer is cached across source
# changes; only a package.json change busts it.
COPY package*.json ./
RUN npm ci

COPY . .

# The API base URL is baked in at build time. In the compose stack the web container is
# served behind the same host as the API, so the default empty base (same-origin) works;
# override VITE_API_BASE_URL for a split deployment.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- serve stage ---------------------------------------------------------------
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
# Copied as a template: at start-up nginx replaces ${VPS_API_UPSTREAM} with the environment
# value and writes /etc/nginx/conf.d/default.conf. Override it to reach an API that is not
# the compose service 'api', e.g. -e VPS_API_UPSTREAM=http://10.0.0.5:8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV VPS_API_UPSTREAM=http://api:8080
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
