FROM node:22-bookworm-slim
WORKDIR /app
COPY ["Okanjo/共通/OISO/common-relay/package.json", "Okanjo/共通/OISO/common-relay/package-lock.json", "./"]
RUN npm ci --omit=dev && npm cache clean --force
COPY ["Okanjo/共通/OISO/common-relay/index.mjs", "Okanjo/共通/OISO/common-relay/lifecycle.mjs", "./"]
RUN mkdir -p /app/relay-data && chown node:node /app/relay-data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 RELAY_DATA_DIR=/app/relay-data
USER node:node
EXPOSE 3000
CMD ["node", "index.mjs"]
