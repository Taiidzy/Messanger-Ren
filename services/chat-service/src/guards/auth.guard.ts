import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  user_id: number;
  login: string;
  userName?: string;
  avatar?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Токен не предоставлен');
    }

    try {
      const authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL');

      if (!authServiceUrl) {
        this.logger.error('AUTH_SERVICE_URL не настроен');
        throw new UnauthorizedException('Сервис авторизации недоступен');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${authServiceUrl}/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      const user: AuthUser = response.data;
      request.user = user;

      return true;
    } catch (error) {
      this.logger.error('Ошибка проверки токена:', error.message);
      throw new UnauthorizedException('Недействительный токен');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
