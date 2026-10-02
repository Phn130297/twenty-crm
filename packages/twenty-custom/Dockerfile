FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/
COPY data/ ./data/
COPY public/ ./public/

RUN npm install

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./

RUN npx tsc

EXPOSE 4000

CMD ["node", "dist/index.js"]
