package server

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Repository provides DB access for messages
type Repository struct {
	db *sql.DB
}

// NewRepository initializes the DB connection using env variables
func NewRepository() (*Repository, error) {
	user := getEnv("POSTGRES_USER", "postgres")
	pass := getEnv("POSTGRES_PASSWORD", "postgres")
	host := getEnv("POSTGRES_HOST", "localhost")
	port := getEnv("POSTGRES_PORT", "5432")
	dbname := getEnv("POSTGRES_DB", "postgres")
	sslmode := getEnv("POSTGRES_SSLMODE", "disable")

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, pass, host, port, dbname, sslmode)

	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// Reasonable limits
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}

	return &Repository{db: db}, nil
}

// SaveMessage inserts a new message and returns its ID
func (r *Repository) SaveMessage(ctx context.Context, m MessageData) (int, error) {
	// Dynamic chat table name
	chatTable := fmt.Sprintf("chat_%d", m.ChatID)

	// Decode ciphertext and nonce from base64/hex to []byte
	ciphertextBytes := decodeBytes(m.Ciphertext)
	nonceBytes := decodeBytes(m.Nonce)

	// Envelopes as JSON string (to match core-api)
	var envelopesJSON string
	if m.Envelopes != nil {
		b, err := json.Marshal(m.Envelopes)
		if err != nil {
			return 0, fmt.Errorf("marshal envelopes: %w", err)
		}
		envelopesJSON = string(b)
	} else {
		envelopesJSON = "{}"
	}

	// Metadata as JSON string or NULL
	var metadataJSON *string
	if m.Metadata != nil {
		b, err := json.Marshal(m.Metadata)
		if err != nil {
			return 0, fmt.Errorf("marshal metadata: %w", err)
		}
		s := string(b)
		metadataJSON = &s
	}

	// Parse created_at and edited_at similar to core-api behavior
	createdAt := parseDatetime(m.CreatedAt)
	var editedAt *time.Time
	if m.EditedAt != nil {
		t := parseDatetime(*m.EditedAt)
		editedAt = &t
	}

	query := fmt.Sprintf(`
		INSERT INTO %s
		(sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, chatTable)

	var id int
	if err := r.db.QueryRowContext(
		ctx, query,
		m.SenderID,
		ciphertextBytes,
		nonceBytes,
		envelopesJSON,
		m.MessageType,
		metadataJSON,
		createdAt,
		editedAt,
		m.IsRead,
	).Scan(&id); err != nil {
		return 0, fmt.Errorf("insert message: %w", err)
	}
	return id, nil
}

// EditMessage updates fields of a message if provided and returns the updated row's edited_at timestamp
func (r *Repository) EditMessage(ctx context.Context, chatID, messageID, userID int, edit EditMessageData) (time.Time, error) {
	chatTable := fmt.Sprintf("chat_%d", chatID)

	// Ensure ownership: only sender can edit
	var senderID int
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf("SELECT sender_id FROM %s WHERE id = $1", chatTable), messageID).Scan(&senderID); err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, fmt.Errorf("not_found")
		}
		return time.Time{}, fmt.Errorf("select sender: %w", err)
	}
	if senderID != userID {
		return time.Time{}, fmt.Errorf("forbidden")
	}

	setParts := []string{"edited_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if edit.Ciphertext != nil {
		setParts = append(setParts, fmt.Sprintf("ciphertext = $%d", argIdx))
		args = append(args, decodeBytes(*edit.Ciphertext))
		argIdx++
	}
	if edit.Nonce != nil {
		setParts = append(setParts, fmt.Sprintf("nonce = $%d", argIdx))
		args = append(args, decodeBytes(*edit.Nonce))
		argIdx++
	}
	if edit.Envelopes != nil {
		b, err := json.Marshal(edit.Envelopes)
		if err != nil {
			return time.Time{}, fmt.Errorf("marshal envelopes: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("envelopes = $%d", argIdx))
		args = append(args, string(b))
		argIdx++
	}
	if edit.MessageType != nil {
		setParts = append(setParts, fmt.Sprintf("message_type = $%d", argIdx))
		args = append(args, *edit.MessageType)
		argIdx++
	}
	if edit.Metadata != nil {
		b, err := json.Marshal(edit.Metadata)
		if err != nil {
			return time.Time{}, fmt.Errorf("marshal metadata: %w", err)
		}
		// metadata can be NULL
		setParts = append(setParts, fmt.Sprintf("metadata = $%d", argIdx))
		s := string(b)
		args = append(args, &s)
		argIdx++
	}

	// Build UPDATE
	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d RETURNING edited_at", chatTable, joinComma(setParts), argIdx)
	args = append(args, messageID)

	var editedAt time.Time
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&editedAt); err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, fmt.Errorf("not_found")
		}
		return time.Time{}, fmt.Errorf("update message: %w", err)
	}
	return editedAt, nil
}

// DeleteMessage deletes a message by id/chat and user
func (r *Repository) DeleteMessage(ctx context.Context, chatID, messageID, userID int) error {
	chatTable := fmt.Sprintf("chat_%d", chatID)
	filesTable := fmt.Sprintf("chat_%d_files", chatID)

	// Ensure ownership
	var senderID int
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf("SELECT sender_id FROM %s WHERE id = $1", chatTable), messageID).Scan(&senderID); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not_found")
		}
		return fmt.Errorf("select sender: %w", err)
	}
	if senderID != userID {
		return fmt.Errorf("forbidden")
	}

	// Delete file rows first (filesystem cleanup is handled elsewhere in core-api; here we only clean DB)
	if _, err := r.db.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE message_id = $1", filesTable), messageID); err != nil {
		return fmt.Errorf("delete files: %w", err)
	}

	res, err := r.db.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE id = $1", chatTable), messageID)
	if err != nil {
		return fmt.Errorf("delete message: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("not_found")
	}
	return nil
}

func (r *Repository) Close() error { return r.db.Close() }

// Helpers
func joinComma(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	res := parts[0]
	for i := 1; i < len(parts); i++ {
		res += ", " + parts[i]
	}
	return res
}

// decodeBytes tries base64 and then hex, returns empty on failure
func decodeBytes(val string) []byte {
	if val == "" {
		return []byte{}
	}
	// base64
	if b, err := base64.StdEncoding.DecodeString(val); err == nil {
		return b
	}
	// hex
	if b, err := hex.DecodeString(val); err == nil {
		return b
	}
	return []byte{}
}

// parseDatetime parses ISO8601 or HH:MM:SS (today) into time.Time
func parseDatetime(s string) time.Time {
	if s == "" {
		return time.Now()
	}
	// Try HH:MM:SS case
	if len(s) == 8 && strings.Count(s, ":") == 2 {
		today := time.Now().Format("2006-01-02")
		if t, err := time.Parse("2006-01-02 15:04:05", today+" "+s); err == nil {
			return t
		}
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	// Fallback now
	return time.Now()
}
