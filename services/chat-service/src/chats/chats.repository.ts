import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Message } from './interfaces/chat.interface';
import { Chat } from '@prisma/client';

@Injectable()
export class ChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatByUsers(user1Id: number, user2Id: number): Promise<Chat | null> {
    return this.prisma.chat.findFirst({
      where: {
        OR: [
          { user1Id, user2Id },
          { user1Id: user2Id, user2Id: user1Id },
        ],
      },
    });
  }

  async createChat(user1Id: number, user2Id: number): Promise<Chat> {
    // Перед созданием чата убеждаемся, что в БД у столбца chats.id включена автоинкрементная генерация
    await this.ensureChatsIdIdentity();

    return this.prisma.chat.create({
      data: {
        user1Id,
        user2Id,
      },
    });
  }

  async findChatById(id: number): Promise<Chat | null> {
    return this.prisma.chat.findUnique({
      where: { id },
    });
  }

  async findUserChats(userId: number): Promise<Chat[]> {
    return this.prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteChat(id: number): Promise<void> {
    await this.prisma.chat.delete({
      where: { id },
    });
  }

  // Получение информации о пользователе
  async findUserById(userId: number): Promise<any> {
    return this.prisma.$queryRawUnsafe(`
      SELECT id, login, "userName", "publicKey", avatar 
      FROM users 
      WHERE id = $1
    `, userId);
  }

  // Получение последнего сообщения из чата
  async getLastMessage(chatId: number): Promise<any> {
    const result = await this.prisma.$queryRawUnsafe(`
      SELECT id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read 
      FROM chat_${chatId} 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    return Array.isArray(result) && result.length > 0 ? result[0] : null;
  }

  // Получение всех сообщений из чата
  async getAllMessage(chatId: number): Promise<Message[]> {
    const result = await this.prisma.$queryRawUnsafe(`
      SELECT id, ${chatId} as chat_id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read 
      FROM chat_${chatId} 
      ORDER BY created_at ASC
    `);
    
    if (!Array.isArray(result)) {
        return [];
    }
    
    // Преобразуем binary данные в base64
    return result.map(message => ({
        ...message,
        ciphertext: this.bufferToBase64(message.ciphertext),
        nonce: this.bufferToBase64(message.nonce)
    }));
  }

  // Создание таблиц для сообщений через raw SQL
  async createChatTables(chatId: number): Promise<void> {
    // Создание таблицы сообщений
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_${chatId} (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        ciphertext BYTEA NOT NULL,
        nonce BYTEA NOT NULL,
        envelopes JSONB NOT NULL,
        message_type VARCHAR(25) NOT NULL DEFAULT 'text',
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        edited_at TIMESTAMP NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    // Создание таблицы файлов
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_${chatId}_files (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        file_id BIGINT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (message_id) REFERENCES chat_${chatId}(id) ON DELETE CASCADE
      );
    `);
  }

  async dropChatTables(chatId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS chat_${chatId}_files CASCADE;`);
    await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS chat_${chatId} CASCADE;`);
  }

  private bufferToBase64(data: any): string {
    if (!data) return '';
    
    // Если данные приходят как объект с числовыми ключами
    if (typeof data === 'object' && !Buffer.isBuffer(data)) {
        const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
        const uint8Array = new Uint8Array(keys.map(key => data[key]));
        return Buffer.from(uint8Array).toString('base64');
    }
    
    // Если это уже Buffer
    if (Buffer.isBuffer(data)) {
        return data.toString('base64');
    }
    
    // Если это Uint8Array
    if (data instanceof Uint8Array) {
        return Buffer.from(data).toString('base64');
    }
    
    return '';
  }

  // Проверяет и при необходимости исправляет отсутствие автоинкрементного значения у столбца chats.id
  private async ensureChatsIdIdentity(): Promise<void> {
    try {
      // Проверяем, есть ли у столбца id default/identity
      const checkResult: Array<{ column_default: string | null; is_identity: string | null }> = await this.prisma.$queryRawUnsafe(
        `
        SELECT column_default, is_identity
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'id'
        `,
      );

      const info = Array.isArray(checkResult) && checkResult.length > 0 ? checkResult[0] : null;
      const hasDefault = !!(info && info.column_default);
      const isIdentity = !!(info && (info.is_identity === 'YES' || info.is_identity === 'YES' as any));

      if (!hasDefault && !isIdentity) {
        // Пытаемся добавить identity-генерацию (PostgreSQL 10+)
        await this.prisma.$executeRawUnsafe(`
          ALTER TABLE chats
          ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY
        `);
      }
    } catch (e) {
      // На некоторых БД (старые версии) команда выше может не поддерживаться.
      // В таком случае пробуем задать default через последовательность, если она уже существует.
      try {
        await this.prisma.$executeRawUnsafe(`
          DO $$
          DECLARE seq_name text;
          BEGIN
            -- пытаемся найти связанную последовательность
            SELECT pg_get_serial_sequence('chats', 'id') INTO seq_name;
            IF seq_name IS NOT NULL THEN
              EXECUTE 'ALTER TABLE chats ALTER COLUMN id SET DEFAULT nextval(''' || seq_name || ''')';
            END IF;
          END $$;
        `);
      } catch {
        // Игнорируем: если не удалось автоматически исправить, пусть ошибка проявится на create(),
        // это даст нам явный сигнал о проблеме в схеме БД.
      }
    }
  }
}