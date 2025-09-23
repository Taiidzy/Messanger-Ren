# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все исходники
COPY . .

# Генерируем Prisma клиент
RUN npx prisma generate

# Собираем NestJS в dist
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /usr/src/app

# Копируем только нужное из build stage
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma

# Указываем порт
EXPOSE 3002

# Запуск приложения
CMD ["node", "dist/main.js"]
