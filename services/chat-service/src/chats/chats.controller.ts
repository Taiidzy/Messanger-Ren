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
    Query,
    DefaultValuePipe,
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
      @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
      @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ): Promise<Message[]> {
      return this.chatsService.getMessagesChat(chatId, req.user, { limit, offset });
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