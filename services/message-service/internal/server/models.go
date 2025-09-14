package server

import (
	"github.com/gorilla/websocket"
)

// MessageTypes содержит типы сообщений
type MessageTypes struct {
	REGISTER       string
	MESSAGE        string
	EDIT_MESSAGE   string
	DELETE_MESSAGE string
	REGISTERED     string
	NEW_MESSAGE    string
	MESSAGE_SENT   string
	ERROR          string
	MESSAGE_DELETED string
	MESSAGE_EDITED  string
}

var MESSAGE_TYPES = MessageTypes{
	REGISTER:        "register",
	MESSAGE:         "message",
	EDIT_MESSAGE:    "edit_message",
	DELETE_MESSAGE:  "delete_message",
	REGISTERED:      "registered",
	NEW_MESSAGE:     "new_message",
	MESSAGE_SENT:    "message_sent",
	ERROR:           "error",
	MESSAGE_DELETED: "message_deleted",
	MESSAGE_EDITED:  "message_edited",
}

// ClientInfo информация о подключенном клиенте
type ClientInfo struct {
	UserID int             `json:"user_id"`
	ChatID int             `json:"chat_id"`
	Conn   *websocket.Conn `json:"-"`
	Token  string          `json:"-"`
}

// IncomingMessage входящее сообщение от клиента
type IncomingMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
	// Для регистрации
	Token  string `json:"token,omitempty"`
	ChatID int    `json:"chat_id,omitempty"`
}

// OutgoingMessage исходящее сообщение клиенту
type OutgoingMessage struct {
	Type    string      `json:"type"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// MessageData данные сообщения чата
type MessageData struct {
	ID          interface{}            `json:"id"`
	ChatID      int                    `json:"chat_id"`
	SenderID    int                    `json:"sender_id"`
	MessageType string                 `json:"message_type"`
	CreatedAt   string                 `json:"created_at"`
	EditedAt    *string                `json:"edited_at"`
	IsRead      bool                   `json:"is_read"`
	Ciphertext  string                 `json:"ciphertext"`
	Nonce       string                 `json:"nonce"`
	Metadata    interface{}            `json:"metadata"`
	Envelopes   map[string]interface{} `json:"envelopes"`
}

// DeleteMessageData данные для удаления сообщения
type DeleteMessageData struct {
	ChatID    int `json:"chat_id"`
	MessageID int `json:"message_id"`
}

// EditMessageData данные для редактирования сообщения
type EditMessageData struct {
	ID          int                    `json:"id"`
	ChatID      int                    `json:"chat_id"`
	Ciphertext  *string                `json:"ciphertext,omitempty"`
	Nonce       *string                `json:"nonce,omitempty"`
	MessageType *string                `json:"message_type,omitempty"`
	Metadata    interface{}            `json:"metadata,omitempty"`
	Envelopes   map[string]interface{} `json:"envelopes,omitempty"`
}

// AuthResponse ответ от auth сервера
type AuthResponse struct {
	UserID int `json:"user_id"`
}

// SavedMessageResponse ответ от DB сервера
type SavedMessageResponse struct {
	MessageID interface{} `json:"message_id"`
}

// EditedMessage сообщение после редактирования
type EditedMessage struct {
	ID          int                    `json:"id"`
	ChatID      int                    `json:"chat_id"`
	SenderID    int                    `json:"sender_id"`
	Ciphertext  string                 `json:"ciphertext"`
	Nonce       string                 `json:"nonce"`
	Envelopes   map[string]interface{} `json:"envelopes"`
	MessageType string                 `json:"message_type"`
	Metadata    interface{}            `json:"metadata"`
	EditedAt    string                 `json:"edited_at"`
}

