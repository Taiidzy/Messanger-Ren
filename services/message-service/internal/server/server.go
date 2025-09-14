package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Разрешаем все origins для разработки
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// ChatServer основная структура сервера
type ChatServer struct {
	port          int
	dbServerURL   string
	authServerURL string
	redisClient   *RedisClient
	clients       map[*websocket.Conn]*ClientInfo
	mu            sync.RWMutex
	server        *http.Server
	httpClient    *http.Client
}

// NewChatServer создает новый экземпляр сервера
func NewChatServer() *ChatServer {
	port, err := strconv.Atoi(getEnv("APP_PORT", "3000"))
	if err != nil {
		port = 3000
	}

	coreAPIURL := getEnv("AUTH_HOST", "http://localhost:8000")
	dbServerURL := coreAPIURL + "/chat/massage"
	authServerURL := coreAPIURL + "/auth/verify"

	redisClient, err := NewRedisClient()
	if err != nil {
		log.Fatalf("Ошибка инициализации Redis: %v", err)
	}

	return &ChatServer{
		port:          port,
		dbServerURL:   dbServerURL,
		authServerURL: authServerURL,
		redisClient:   redisClient,
		clients:       make(map[*websocket.Conn]*ClientInfo),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// Start запускает WebSocket сервер
func (s *ChatServer) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/message-service", s.handleWebSocket)
	mux.HandleFunc("/health", s.handleHealth)

	s.server = &http.Server{
		Addr:         ":" + strconv.Itoa(s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("WebSocket сервер запущен на порту %d (путь /ws)", s.port)
	return s.server.ListenAndServe()
}

// Stop останавливает сервер
func (s *ChatServer) Stop(ctx context.Context) error {
	log.Println("Начинаем остановку сервера...")

	// Закрываем все WebSocket соединения
	s.closeAllConnections()

	// Закрываем Redis
	if s.redisClient != nil {
		if err := s.redisClient.Close(); err != nil {
			log.Printf("Ошибка закрытия Redis: %v", err)
		}
	}

	// Останавливаем HTTP сервер
	if s.server != nil {
		log.Println("Останавливаем HTTP сервер...")
		return s.server.Shutdown(ctx)
	}

	return nil
}

// closeAllConnections закрывает все WebSocket соединения
func (s *ChatServer) closeAllConnections() {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("Закрываем %d активных соединений...", len(s.clients))
	for conn, clientInfo := range s.clients {
		// Отправляем уведомление о закрытии
		closeMsg := OutgoingMessage{
			Type:    MESSAGE_TYPES.ERROR,
			Message: "Сервер завершает работу",
		}
		s.sendJSON(conn, closeMsg)

		// Закрываем соединение
		conn.Close()

		// Удаляем из Redis
		ctx := context.Background()
		if err := s.redisClient.RemoveFromChatRoom(ctx, clientInfo.ChatID, clientInfo.UserID); err != nil {
			log.Printf("Ошибка удаления пользователя %d из чата %d: %v", clientInfo.UserID, clientInfo.ChatID, err)
		}
	}

	// Очищаем карту клиентов
	s.clients = make(map[*websocket.Conn]*ClientInfo)
}

// handleHealth обработчик health check
func (s *ChatServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"timestamp":   time.Now().Unix(),
		"connections": s.getConnectionsCount(),
	})
}

// getConnectionsCount возвращает количество активных соединений
func (s *ChatServer) getConnectionsCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.clients)
}

// handleWebSocket обрабатывает WebSocket подключения
func (s *ChatServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Ошибка обновления соединения: %v", err)
		return
	}

	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.Header.Get("X-Forwarded-For")
	}
	if ip == "" {
		ip = r.RemoteAddr
	}

	log.Printf("Новое подключение от IP: %s", ip)

	// Устанавливаем таймауты
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	// Настраиваем пинг/понг для проверки соединения
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Запускаем горутину для периодической отправки пингов
	go s.pingHandler(conn)

	// Основной цикл чтения сообщений
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Ошибка WebSocket: %v", err)
			}
			break
		}

		// Обновляем deadline при получении сообщения
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		s.handleMessage(conn, message)
	}

	s.handleDisconnect(conn)
}

// pingHandler периодически отправляет ping сообщения
func (s *ChatServer) pingHandler(conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				return
			}
		}
	}
}

// handleDisconnect обрабатывает отключение клиента
func (s *ChatServer) handleDisconnect(conn *websocket.Conn) {
	s.mu.Lock()
	clientInfo, exists := s.clients[conn]
	if exists {
		delete(s.clients, conn)
	}
	s.mu.Unlock()

	if exists {
		ctx := context.Background()
		if err := s.redisClient.RemoveFromChatRoom(ctx, clientInfo.ChatID, clientInfo.UserID); err != nil {
			log.Printf("Ошибка удаления из Redis: %v", err)
		}
		log.Printf("Пользователь %d отключился от чата %d", clientInfo.UserID, clientInfo.ChatID)
	} else {
		log.Printf("Неизвестный клиент отключился")
	}
}

// verifyToken проверяет токен через auth сервер
func (s *ChatServer) verifyToken(token string) (int, error) {
	log.Printf("Проверка токена через auth сервер: %s", s.authServerURL)

	req, err := http.NewRequest("GET", s.authServerURL, nil)
	if err != nil {
		return 0, fmt.Errorf("ошибка создания запроса: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("ошибка запроса к auth серверу: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return 0, fmt.Errorf("401: Недействительный токен")
	}

	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("auth сервер вернул статус %d", resp.StatusCode)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return 0, fmt.Errorf("ошибка парсинга ответа auth сервера: %v", err)
	}

	if authResp.UserID == 0 {
		return 0, fmt.Errorf("неверный ответ от auth сервера")
	}

	log.Printf("Токен валиден для пользователя %d", authResp.UserID)
	return authResp.UserID, nil
}

// saveMessageToDatabase сохраняет сообщение в БД
func (s *ChatServer) saveMessageToDatabase(messageData MessageData) (*SavedMessageResponse, error) {
	log.Printf("Отправка сообщения в БД по адресу: %s", s.dbServerURL)

	jsonData, err := json.Marshal(messageData)
	if err != nil {
		return nil, fmt.Errorf("ошибка сериализации: %v", err)
	}

	req, err := http.NewRequest("POST", s.dbServerURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сетевая ошибка: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP ошибка: %d", resp.StatusCode)
	}

	var savedResp SavedMessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&savedResp); err != nil {
		return nil, fmt.Errorf("ошибка парсинга ответа БД: %v", err)
	}

	log.Printf("Сообщение успешно сохранено в БД. Статус: %d", resp.StatusCode)
	return &savedResp, nil
}

// broadcastToChat рассылает сообщение всем участникам чата
func (s *ChatServer) broadcastToChat(chatID int, message MessageData, senderConn *websocket.Conn) {
	ctx := context.Background()
	chatMembers, err := s.redisClient.GetChatMembers(ctx, chatID)
	if err != nil {
		log.Printf("Ошибка получения участников чата %d: %v", chatID, err)
		return
	}

	if len(chatMembers) == 0 {
		log.Printf("Нет участников в чате %d", chatID)
		return
	}

	messageForOthers := OutgoingMessage{
		Type: MESSAGE_TYPES.NEW_MESSAGE,
		Data: message,
	}

	confirmationForSender := OutgoingMessage{
		Type: MESSAGE_TYPES.NEW_MESSAGE,
		Data: message,
	}

	sentCount := 0
	s.mu.RLock()
	for conn, clientInfo := range s.clients {
		if clientInfo.ChatID == chatID {
			var msg OutgoingMessage
			if conn == senderConn {
				msg = confirmationForSender
			} else {
				msg = messageForOthers
			}

			if s.sendJSON(conn, msg) {
				sentCount++
			}
		}
	}
	s.mu.RUnlock()

	log.Printf("Сообщение разослано %d участникам чата %d", sentCount, chatID)
}

// broadcastDeleteToChat рассылает событие удаления сообщения
func (s *ChatServer) broadcastDeleteToChat(chatID, messageID int) {
	payload := OutgoingMessage{
		Type: MESSAGE_TYPES.MESSAGE_DELETED,
		Data: map[string]interface{}{
			"message_id": messageID,
		},
	}

	sentCount := 0
	s.mu.RLock()
	for conn, clientInfo := range s.clients {
		if clientInfo.ChatID == chatID {
			if s.sendJSON(conn, payload) {
				sentCount++
			}
		}
	}
	s.mu.RUnlock()

	log.Printf("Удаление сообщения %d разослано %d участникам чата %d", messageID, sentCount, chatID)
}

// broadcastEditToChat рассылает событие редактирования сообщения
func (s *ChatServer) broadcastEditToChat(chatID int, message EditedMessage) {
	payload := OutgoingMessage{
		Type: MESSAGE_TYPES.MESSAGE_EDITED,
		Data: message,
	}

	sentCount := 0
	s.mu.RLock()
	for conn, clientInfo := range s.clients {
		if clientInfo.ChatID == chatID {
			if s.sendJSON(conn, payload) {
				sentCount++
			}
		}
	}
	s.mu.RUnlock()

	log.Printf("Редактирование сообщения %d разослано %d участникам чата %d", message.ID, sentCount, chatID)
}

// sendJSON отправляет JSON сообщение клиенту с таймаутом
func (s *ChatServer) sendJSON(conn *websocket.Conn, message interface{}) bool {
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := conn.WriteJSON(message); err != nil {
		log.Printf("Ошибка отправки сообщения: %v", err)
		return false
	}
	return true
}

// sendError отправляет сообщение об ошибке клиенту
func (s *ChatServer) sendError(conn *websocket.Conn, errorMessage string) {
	errorMsg := OutgoingMessage{
		Type:    MESSAGE_TYPES.ERROR,
		Message: errorMessage,
	}
	s.sendJSON(conn, errorMsg)
}

// getBaseURL возвращает базовый URL для API
func (s *ChatServer) getBaseURL() string {
	coreAPIURL := os.Getenv("AUTH_HOST")
	if coreAPIURL == "" {
		return "http://localhost:8000"
	}
	return coreAPIURL
}

// getEnv возвращает значение переменной окружения или значение по умолчанию
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
