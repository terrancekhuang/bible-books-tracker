FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

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
