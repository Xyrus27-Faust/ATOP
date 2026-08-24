# syntax=docker/dockerfile:1
# Build the ATOP React/Vite SPA and serve the static output via nginx.
#
# NOTE: Vite inlines VITE_* vars at BUILD time, so the API URL and Google
# client id must be passed as build args (the image is environment-specific).

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Use `npm install` (not `npm ci`): the committed lockfile is generated on
# macOS and omits linux/amd64-only optional deps (Tailwind oxide native via
# @emnapi/*), which strict `npm ci` rejects. install resolves them per-platform.
RUN npm install --no-audit --no-fund

COPY . ./

# Baked into the bundle at build time (see src/lib/apiClient.js, GoogleButton.jsx).
ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
# Every feature flag defaults to ENABLED in code (the check is `!== 'false'`), so an unpassed flag
# ships that feature VISIBLE. Prod must pass each one explicitly as "false" to keep a slice dark —
# and a flag missing from this list cannot be passed at all, which is how convention registration
# came within one build of going live on its own.
ARG VITE_FEATURE_SCORING
ARG VITE_FEATURE_FINALS
ARG VITE_FEATURE_EVENTS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_FEATURE_SCORING=$VITE_FEATURE_SCORING \
    VITE_FEATURE_FINALS=$VITE_FEATURE_FINALS \
    VITE_FEATURE_EVENTS=$VITE_FEATURE_EVENTS
RUN npm run build

# --- Static server ---
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
