FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.mjs lifecycle.mjs ./
RUN mkdir -p /app/relay-data && chown node:node /app/relay-data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 RELAY_DATA_DIR=/app/relay-data
USER node:node
EXPOSE 3000
CMD ["node", "index.mjs"]
