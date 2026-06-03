FROM node:20-alpine AS builder
WORKDIR /app

# Root package.json has all deps (react-router-dom, @react-oauth/google, etc.)
COPY package*.json ./
RUN npm ci

# Copy everything vite needs to build
COPY vite.config.ts index.html ./
COPY tsconfig*.json ./
COPY public/ ./public/
COPY frontend/ ./frontend/

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
