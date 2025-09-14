FROM node:20-alpine as base

RUN apk add --no-cache g++ make py3-pip libc6-compat
WORKDIR /backend/realtime-service
COPY . .

FROM base as builder
RUN npm run build


FROM base as production

ENV NODE_ENV=production
RUN npm ci

COPY --from=builder /frontend/node_modules ./node_modules
COPY --from=builder /frontend/package.json ./package.json
COPY --from=builder /frontend/public ./public

CMD npm start

FROM base as dev
ENV NODE_ENV=development
RUN npm install 
CMD npm run dev