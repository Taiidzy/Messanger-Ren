import { Injectable, Logger } from '@nestjs/common';
import { ChatsRepository } from './chats.repository';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatResponse, ChatWithUserInfo, Message } from './interfaces/chat.interface';
import { AuthUser } from '../guards/auth.guard';
import {
  ChatCreationException,
  InvalidCompanionException,
  ChatNotFoundException,
} from './exceptions/chat.exceptions';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(private readonly chatsRepository: ChatsRepository) {}

  async createChat(createChatDto: CreateChatDto, currentUser: AuthUser): Promise<ChatResponse> {
    const { companion_id } = createChatDto;

    // Проверка, что пользователь не создает чат с самим собой
    if (currentUser.user_id === companion_id) {
      throw new InvalidCompanionException();
    }

    try {
      // Проверяем, существует ли уже чат между пользователями
      const existingChat = await this.chatsRepository.findChatByUsers(
        currentUser.user_id,
        companion_id,
      );

      if (existingChat) {
        return this.mapChatToResponse(existingChat);
      }

      // Создаем новый чат
      const newChat = await this.chatsRepository.createChat(currentUser.user_id, companion_id);

      // Создаем таблицы для сообщений
      await this.chatsRepository.createChatTables(newChat.id);

      this.logger.log(`Создан чат ${newChat.id} между пользователями ${currentUser.user_id} и ${companion_id}`);

      return this.mapChatToResponse(newChat);
    } catch (error) {
      this.logger.error(`Ошибка создания чата: ${error.message}`, error.stack);
      
      if (error instanceof InvalidCompanionException) {
        throw error;
      }
      
      throw new ChatCreationException();
    }
  }

  async getUserChats(currentUser: AuthUser): Promise<ChatWithUserInfo[]> {
    try {
      const chats = await this.chatsRepository.findUserChats(currentUser.user_id);
      this.logger.log(`Получен список чатов пользователя ${currentUser.user_id}`);
      
      const result: ChatWithUserInfo[] = [];
      
      for (const chat of chats) {
        const companion_id = chat.user1Id === currentUser.user_id ? chat.user2Id : chat.user1Id;
        
        // Получаем информацию о собеседнике
        const companionData = await this.chatsRepository.findUserById(companion_id);
        const companion = Array.isArray(companionData) && companionData.length > 0 ? companionData[0] : null;
        
        // Получаем последнее сообщение
        const lastMessageData = await this.chatsRepository.getLastMessage(chat.id);
        
        let lastMessage: Message | null = null;
        if (lastMessageData) {
          lastMessage = {
            id: lastMessageData.id,
            chat_id: chat.id,
            sender_id: lastMessageData.sender_id,
            ciphertext: lastMessageData.ciphertext ? Buffer.from(lastMessageData.ciphertext).toString('base64') : '',
            nonce: lastMessageData.nonce ? Buffer.from(lastMessageData.nonce).toString('base64') : '',
            envelopes: lastMessageData.envelopes,
            message_type: lastMessageData.message_type,
            metadata: lastMessageData.metadata,
            created_at: lastMessageData.created_at ? lastMessageData.created_at.toISOString() : null,
            edited_at: lastMessageData.edited_at ? lastMessageData.edited_at.toISOString() : null,
            is_read: lastMessageData.is_read,
          };
        }
        
        result.push({
          chat_id: chat.id,
          user_id: currentUser.user_id,
          companion_id: companion_id,
          created_at: chat.createdAt,
          companion_avatar: companion?.avatar || null,
          companion_userName: companion?.userName || null,
          companion_pubKey: companion?.publicKey || null,
          last_message: lastMessage,
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Ошибка получения чатов пользователя ${currentUser.user_id}: ${error.message}`, error.stack);
      throw new Error('Ошибка получения списка чатов');
    }
  }

  async getChatById(chatId: number, currentUser: AuthUser): Promise<ChatResponse> {
    try {
      const chat = await this.chatsRepository.findChatById(chatId);
      
      if (!chat) {
        throw new ChatNotFoundException();
      }

      // Проверяем, что пользователь является участником чата
      if (chat.user1Id !== currentUser.user_id && chat.user2Id !== currentUser.user_id) {
        throw new ChatNotFoundException();
      }

      return this.mapChatToResponse(chat);
    } catch (error) {
      this.logger.error(`Ошибка получения чата ${chatId}: ${error.message}`, error.stack);
      
      if (error instanceof ChatNotFoundException) {
        throw error;
      }
      
      throw new Error('Ошибка получения чата');
    }
  }

  async getMessagesChat(chatId: number, currentUser: AuthUser): Promise<Message[]> {
    try {
      const chat = await this.chatsRepository.findChatById(chatId);
      
      if (!chat) {
        throw new ChatNotFoundException();
      }

      // Проверяем, что пользователь является участником чата
      if (chat.user1Id !== currentUser.user_id && chat.user2Id !== currentUser.user_id) {
        throw new ChatNotFoundException();
      }

      const messages = await this.chatsRepository.getAllMessage(chatId);
      return messages;
    } catch (error) {
      this.logger.error(`Ошибка получения сообщений чата ${chatId}: ${error.message}`, error.stack);
      throw new Error('Ошибка получения сообщений чата');
    }
  }

  async deleteChat(chatId: number, currentUser: AuthUser): Promise<void> {
    try {
      const chat = await this.chatsRepository.findChatById(chatId);
      
      if (!chat) {
        throw new ChatNotFoundException();
      }

      // Проверяем, что пользователь является участником чата
      if (chat.user1Id !== currentUser.user_id && chat.user2Id !== currentUser.user_id) {
        throw new ChatNotFoundException();
      }

      // Удаляем таблицы сообщений
      await this.chatsRepository.dropChatTables(chatId);
      
      // Удаляем чат
      await this.chatsRepository.deleteChat(chatId);

      this.logger.log(`Чат ${chatId} удален пользователем ${currentUser.user_id}`);
    } catch (error) {
      this.logger.error(`Ошибка удаления чата ${chatId}: ${error.message}`, error.stack);
      
      if (error instanceof ChatNotFoundException) {
        throw error;
      }
      
      throw new Error('Ошибка удаления чата');
    }
  }

  private mapChatToResponse(chat: any): ChatResponse {
    return {
      chatId: chat.id,
      user1Id: chat.user1Id,
      user2Id: chat.user2Id,
      createdAt: chat.createdAt,
    };
  }
}