import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsRepository } from './chats.repository';
import { AuthGuard } from '../guards/auth.guard';

@Module({
  imports: [HttpModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsRepository, AuthGuard],
  exports: [ChatsService, ChatsRepository],
})
export class ChatsModule {}