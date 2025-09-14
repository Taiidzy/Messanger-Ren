package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// handleMessage главный обработчик входящих сообщений
func (s *ChatServer) handleMessage(conn *websocket.Conn, data []byte) {
	var msg IncomingMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("Ошибка парсинга JSON: %v", err)
		s.sendError(conn, "Неверный формат сообщения. Ожидается JSON.")
		return
	}

	log.Printf("Получено сообщение типа \"%s\"", msg.Type)

	switch msg.Type {
	case MESSAGE_TYPES.REGISTER:
		s.registerUser(conn, msg)
	case MESSAGE_TYPES.MESSAGE:
		s.processMessage(conn, msg)
	case MESSAGE_TYPES.DELETE_MESSAGE:
		s.processDeleteMessage(conn, msg)
	case MESSAGE_TYPES.EDIT_MESSAGE:
		s.processEditMessage(conn, msg)
	default:
		log.Printf("Получен неизвестный тип сообщения: %s", msg.Type)
		s.sendError(conn, "Неизвестный тип сообщения")
	}
}

// registerUser регистрирует нового пользователя в системе
func (s *ChatServer) registerUser(conn *websocket.Conn, msg IncomingMessage) {
	if msg.Token == "" || msg.ChatID == 0 {
		s.sendError(conn, "Для регистрации необходимы token и chat_id.")
		return
	}

	userID, err := s.verifyToken(msg.Token)
	if err != nil {
		log.Printf("Ошибка аутентификации при регистрации в чат: %v", err)
		if err.Error() == "401: Недействительный токен" {
			s.sendError(conn, "Недействительный токен аутентификации.")
		} else {
			s.sendError(conn, "Ошибка проверки токена.")
		}
		return
	}

	clientInfo := &ClientInfo{
		UserID: userID,
		ChatID: msg.ChatID,
		Conn:   conn,
		Token:  msg.Token,
	}

	s.mu.Lock()
	s.clients[conn] = clientInfo
	s.mu.Unlock()

	// Добавляем клиента в комнату чата в Redis
	ctx := context.Background()
	if err := s.redisClient.AddToChatRoom(ctx, msg.ChatID, userID); err != nil {
		log.Printf("Ошибка добавления в Redis: %v", err)
	}

	log.Printf("Пользователь %d подключился к чату %d", userID, msg.ChatID)

	response := OutgoingMessage{
		Type:    MESSAGE_TYPES.REGISTERED,
		Message: "Успешно подключен к чату.",
	}

	s.sendJSON(conn, response)
}

// processMessage обрабатывает новое сообщение чата
func (s *ChatServer) processMessage(conn *websocket.Conn, msg IncomingMessage) {
	s.mu.RLock()
	clientInfo, exists := s.clients[conn]
	s.mu.RUnlock()

	if !exists {
		s.sendError(conn, "Пользователь не зарегистрирован. Отправьте сперва сообщение о регистрации.")
		return
	}

	// Парсим данные сообщения
	msgDataBytes, err := json.Marshal(msg.Data)
	if err != nil {
		s.sendError(conn, "Неверный формат данных сообщения.")
		return
	}

	var messageData MessageData
	if err := json.Unmarshal(msgDataBytes, &messageData); err != nil {
		s.sendError(conn, "Неверный формат данных сообщения.")
		return
	}

	// Заполняем недостающие поля
	messageData.ChatID = clientInfo.ChatID
	if messageData.SenderID == 0 {
		messageData.SenderID = clientInfo.UserID
	}
	if messageData.MessageType == "" {
		messageData.MessageType = "text"
	}
	if messageData.Envelopes == nil {
		messageData.Envelopes = make(map[string]interface{})
	}

	log.Printf("Обработка сообщения от user_id: %d в chat_id: %d", messageData.SenderID, messageData.ChatID)

	// Сохраняем в базе данных
	savedMessage, err := s.saveMessageToDatabase(messageData)
	if err != nil {
		log.Printf("Ошибка при сохранении сообщения: %v", err)
		s.sendError(conn, "Произошла ошибка при обработке вашего сообщения.")
		return
	}

	// Обновляем ID сообщения из ответа БД
	if savedMessage.MessageID != nil {
		messageData.ID = savedMessage.MessageID
	}

	// Рассылаем сообщение участникам чата
	s.broadcastToChat(clientInfo.ChatID, messageData, conn)
}

// processDeleteMessage обрабатывает удаление сообщения
func (s *ChatServer) processDeleteMessage(conn *websocket.Conn, msg IncomingMessage) {
	s.mu.RLock()
	clientInfo, exists := s.clients[conn]
	s.mu.RUnlock()

	if !exists {
		s.sendError(conn, "Пользователь не зарегистрирован.")
		return
	}

	// Парсим данные удаления
	deleteDataBytes, err := json.Marshal(msg.Data)
	if err != nil {
		s.sendError(conn, "Неверный формат данных для удаления.")
		return
	}

	var deleteData DeleteMessageData
	if err := json.Unmarshal(deleteDataBytes, &deleteData); err != nil {
		s.sendError(conn, "Неверный формат данных для удаления.")
		return
	}

	if deleteData.ChatID == 0 || deleteData.MessageID == 0 {
		s.sendError(conn, "Для удаления необходимы chat_id и message_id.")
		return
	}

	// Отправляем запрос на удаление в API
	baseURL := s.getBaseURL()
	url := fmt.Sprintf("%s/chat/%d/messages/%d", baseURL, deleteData.ChatID, deleteData.MessageID)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		s.sendError(conn, "Ошибка при удалении сообщения")
		return
	}

	req.Header.Set("Content-Type", "application/json")
	if clientInfo.Token != "" {
		req.Header.Set("Authorization", "Bearer "+clientInfo.Token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Ошибка удаления сообщения: %v", err)
		s.sendError(conn, "Ошибка при удалении сообщения")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		s.broadcastDeleteToChat(deleteData.ChatID, deleteData.MessageID)
	} else {
		s.sendError(conn, fmt.Sprintf("Не удалось удалить сообщение: %d", resp.StatusCode))
	}
}

// processEditMessage обрабатывает редактирование сообщения
func (s *ChatServer) processEditMessage(conn *websocket.Conn, msg IncomingMessage) {
	s.mu.RLock()
	clientInfo, exists := s.clients[conn]
	s.mu.RUnlock()

	if !exists {
		s.sendError(conn, "Пользователь не зарегистрирован.")
		return
	}

	// Парсим данные редактирования
	editDataBytes, err := json.Marshal(msg.Data)
	if err != nil {
		s.sendError(conn, "Неверный формат данных для редактирования.")
		return
	}

	var editData EditMessageData
	if err := json.Unmarshal(editDataBytes, &editData); err != nil {
		s.sendError(conn, "Неверный формат данных для редактирования.")
		return
	}

	if editData.ID == 0 || editData.ChatID == 0 {
		s.sendError(conn, "Для редактирования необходимы id и chat_id.")
		return
	}

	// Отправляем запрос на редактирование в API
	baseURL := s.getBaseURL()
	url := fmt.Sprintf("%s/chat/%d/messages/%d", baseURL, editData.ChatID, editData.ID)

	payload, err := json.Marshal(editData)
	if err != nil {
		s.sendError(conn, "Ошибка при редактировании сообщения")
		return
	}

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(payload))
	if err != nil {
		s.sendError(conn, "Ошибка при редактировании сообщения")
		return
	}

	req.Header.Set("Content-Type", "application/json")
	if clientInfo.Token != "" {
		req.Header.Set("Authorization", "Bearer "+clientInfo.Token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Ошибка редактирования сообщения: %v", err)
		s.sendError(conn, "Ошибка при редактировании сообщения")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		editedMessage := EditedMessage{
			ID:          editData.ID,
			ChatID:      editData.ChatID,
			SenderID:    clientInfo.UserID,
			Ciphertext:  getString(editData.Ciphertext, ""),
			Nonce:       getString(editData.Nonce, ""),
			Envelopes:   editData.Envelopes,
			MessageType: getString(editData.MessageType, "text"),
			Metadata:    editData.Metadata,
			EditedAt:    time.Now().Format(time.RFC3339),
		}
		if editedMessage.Envelopes == nil {
			editedMessage.Envelopes = make(map[string]interface{})
		}
		s.broadcastEditToChat(editData.ChatID, editedMessage)
	} else {
		s.sendError(conn, fmt.Sprintf("Не удалось обновить сообщение: %d", resp.StatusCode))
	}
}

// getString возвращает значение строкового указателя или значение по умолчанию
func getString(ptr *string, defaultValue string) string {
	if ptr != nil {
		return *ptr
	}
	return defaultValue
}