import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    Request,
  } from '@nestjs/common';
  import { ChatsService } from './chats.service';
  import { CreateChatDto } from './dto/create-chat.dto';
  import { ChatResponse, ChatWithUserInfo, Message } from './interfaces/chat.interface';
  import { AuthGuard, AuthUser } from '../guards/auth.guard';
  
  @Controller('chats')
  @UseGuards(AuthGuard)
  export class ChatsController {
    constructor(private readonly chatsService: ChatsService) {}
  
    @Post()
    async createChat(
      @Body() createChatDto: CreateChatDto,
      @Request() req: { user: AuthUser },
    ): Promise<ChatResponse> {
      return this.chatsService.createChat(createChatDto, req.user);
    }
  
    @Get()
    async getUserChats(@Request() req: { user: AuthUser }): Promise<ChatWithUserInfo[]> {
      return this.chatsService.getUserChats(req.user);
    }

    @Get('/:id/messages')
    async getChatMessages(
      @Param('id', ParseIntPipe) chatId: number,
      @Request() req: { user: AuthUser },
    ): Promise<Message[]> {
      return this.chatsService.getMessagesChat(chatId, req.user);
    }
  
    @Get(':id')
    async getChatById(
      @Param('id', ParseIntPipe) chatId: number,
      @Request() req: { user: AuthUser },
    ): Promise<ChatResponse> {
      return this.chatsService.getChatById(chatId, req.user);
    }
  
    @Delete(':id')
    async deleteChat(
      @Param('id', ParseIntPipe) chatId: number,
      @Request() req: { user: AuthUser },
    ): Promise<{ message: string }> {
      await this.chatsService.deleteChat(chatId, req.user);
      return { message: 'Чат успешно удален' };
    }
}