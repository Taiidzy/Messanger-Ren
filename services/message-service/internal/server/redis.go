package server

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/redis/go-redis/v9"
)

// RedisClient обертка для работы с Redis
type RedisClient struct {
	client *redis.Client
}

// NewRedisClient создает новый Redis клиент
func NewRedisClient() (*RedisClient, error) {
	redisURL := os.Getenv("REDIS_HOST")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("ошибка парсинга Redis URL: %v", err)
	}

	client := redis.NewClient(opts)

	// Проверяем соединение
	ctx := context.Background()
	_, err = client.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("ошибка подключения к Redis: %v", err)
	}

	log.Println("Подключение к Redis установлено")

	return &RedisClient{client: client}, nil
}

// AddToChatRoom добавляет пользователя в комнату чата
func (r *RedisClient) AddToChatRoom(ctx context.Context, chatID, userID int) error {
	key := fmt.Sprintf("chatRooms:%d", chatID)
	err := r.client.SAdd(ctx, key, strconv.Itoa(userID)).Err()
	if err != nil {
		return fmt.Errorf("ошибка добавления пользователя %d в чат %d: %v", userID, chatID, err)
	}
	
	log.Printf("Пользователь %d добавлен в чат %d", userID, chatID)
	return nil
}

// RemoveFromChatRoom удаляет пользователя из комнаты чата
func (r *RedisClient) RemoveFromChatRoom(ctx context.Context, chatID, userID int) error {
	key := fmt.Sprintf("chatRooms:%d", chatID)
	err := r.client.SRem(ctx, key, strconv.Itoa(userID)).Err()
	if err != nil {
		return fmt.Errorf("ошибка удаления пользователя %d из чата %d: %v", userID, chatID, err)
	}

	// Проверяем, остались ли участники в чате
	count, err := r.client.SCard(ctx, key).Result()
	if err != nil {
		log.Printf("Ошибка проверки количества участников в чате %d: %v", chatID, err)
		return nil
	}

	if count == 0 {
		if err := r.client.Del(ctx, key).Err(); err != nil {
			log.Printf("Ошибка удаления пустого чата %d: %v", chatID, err)
		} else {
			log.Printf("Чат %d пуст и был удален", chatID)
		}
	}

	log.Printf("Пользователь %d удален из чата %d", userID, chatID)
	return nil
}

// GetChatMembers получает список участников чата
func (r *RedisClient) GetChatMembers(ctx context.Context, chatID int) ([]string, error) {
	key := fmt.Sprintf("chatRooms:%d", chatID)
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("ошибка получения участников чата %d: %v", chatID, err)
	}
	return members, nil
}

// Close закрывает соединение с Redis
func (r *RedisClient) Close() error {
	if err := r.client.Close(); err != nil {
		return fmt.Errorf("ошибка закрытия соединения с Redis: %v", err)
	}
	log.Println("Соединение с Redis закрыто")
	return nil
}