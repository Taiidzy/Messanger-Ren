import { HttpException, HttpStatus } from '@nestjs/common';

export class ChatNotFoundException extends HttpException {
  constructor() {
    super('Чат не найден', HttpStatus.NOT_FOUND);
  }
}

export class ChatAlreadyExistsException extends HttpException {
  constructor() {
    super('Чат уже существует', HttpStatus.CONFLICT);
  }
}

export class ChatCreationException extends HttpException {
  constructor(message = 'Ошибка при создании чата') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class InvalidCompanionException extends HttpException {
  constructor() {
    super('Нельзя создать чат с самим собой', HttpStatus.BAD_REQUEST);
  }
}