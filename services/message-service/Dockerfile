# Этап 1: Сборка приложения
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей и загружаем их
COPY go.mod go.sum ./
# Эта команда (tidy) вызвала ошибку, но теперь она будет работать с правильной версией Go
RUN go mod tidy
RUN go mod download

# Копируем исходный код
COPY . .

# Собираем статически скомпилированный бинарный файл
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o message-service ./main.go

# Этап 2: Создание минимального финального образа
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Копируем скомпилированный бинарный файл из этапа сборки
COPY --from=builder /app/message-service .

# Открываем порт, который будет слушать приложение
EXPOSE 3000

# Команда для запуска приложения
CMD ["./message-service"]