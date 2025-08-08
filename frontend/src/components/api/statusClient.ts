/* eslint-disable @typescript-eslint/no-explicit-any */
// Типы для сообщений статуса
interface StatusRegisterMessage {
    type: 'status_register';
    token: string;
    contacts: number[];
}

interface StatusRegisteredMessage {
    type: 'status_registered';
    message: string;
}

interface ContactStatus {
    user_id: number;
    status: 'online' | 'offline';
    last_seen: string | null;
}

interface StatusUpdateMessage {
    type: 'status_update';
    data: {
        contacts: ContactStatus[];
    };
}

// ИСПРАВЛЕНО: Добавлено поле last_seen в ContactStatusMessage
interface ContactStatusMessage {
    type: 'contact_status';
    data: {
        user_id: number;
        status: 'online' | 'offline';
        timestamp: string;
        last_seen: string | null; // ДОБАВЛЕНО: поле last_seen
    };
}

interface ErrorMessage {
    type: 'error';
    message: string;
}
  
// Объединенный тип для всех входящих сообщений
type IncomingMessage = StatusRegisteredMessage | StatusUpdateMessage | ContactStatusMessage | ErrorMessage;

// Класс для управления статусом онлайн
class OnlineStatusClient {
    private static instance: OnlineStatusClient; // Статическое свойство для хранения единственного экземпляра
    private ws: WebSocket | null = null;
    private token: string;
    private contacts: number[];
    private onlineContacts: Map<number, ContactStatus> = new Map();

    // Колбэки для обработки событий
    private onStatusRegistered?: () => void;
    private onContactsUpdate?: (contacts: ContactStatus[]) => void;
    private onContactStatusChange?: (contact: ContactStatus) => void;
    private onError?: (error: string) => void;
    private onDisconnected?: () => void;

    // Приватный конструктор для предотвращения прямого создания экземпляров
    private constructor(token: string, contacts: number[]) {
        this.token = token;
        this.contacts = contacts;
    }

    // Статический метод для получения единственного экземпляра
    public static getInstance(token: string, contacts: number[]): OnlineStatusClient {
        if (!OnlineStatusClient.instance) {
            OnlineStatusClient.instance = new OnlineStatusClient(token, contacts);
        }
        return OnlineStatusClient.instance;
    }

    // Подключение к серверу
    connect(serverUrl: string = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3000/ws'): Promise<void> {
        return new Promise((resolve, reject) => {
        try {
            if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
                resolve();
                return;
            }

            this.ws = new WebSocket(serverUrl);

            this.ws.onopen = () => {
                this.registerStatus();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onclose = () => {
                this.onDisconnected?.();
                // Очищаем синглтон при закрытии, чтобы можно было создать новый экземпляр при следующем подключении
                OnlineStatusClient.instance = null as any; 
            };

            this.ws.onerror = (error) => {
                reject(error);
            };

        } catch (error) {
            reject(error);
        }
        });
    }

    // Отправка сообщения о регистрации статуса
    private registerStatus(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket не подключен');
        return;
        }

        const message: StatusRegisterMessage = {
        type: 'status_register',
        token: this.token,
        contacts: this.contacts
        };

        this.ws.send(JSON.stringify(message));
    }

    // Обработка входящих сообщений
    private handleMessage(data: string): void {
        try {
            const message: IncomingMessage = JSON.parse(data);

            switch (message.type) {
                case 'status_registered':
                    this.onStatusRegistered?.();
                break;

                case 'status_update':
                    this.updateContactsStatuses(message.data.contacts);
                    this.onContactsUpdate?.(message.data.contacts);
                break;

                case 'contact_status': { 
                    this.updateSingleContactStatus(message.data);
                    
                    // ИСПРАВЛЕНО: Используем last_seen из сообщения сервера
                    const contactStatus: ContactStatus = {
                        user_id: message.data.user_id,
                        status: message.data.status,
                        last_seen: message.data.last_seen // Берем напрямую из сообщения
                    };
                    this.onContactStatusChange?.(contactStatus);
                break; }

                case 'error':
                    console.error('Ошибка от сервера:', message.message);
                    this.onError?.(message.message);
                break;

                default:
                    console.warn('Неизвестный тип сообщения:', message);
            }
        } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
        }
    }

    // Обновление статусов всех контактов
    private updateContactsStatuses(contacts: ContactStatus[]): void {
        contacts.forEach(contact => {
            this.onlineContacts.set(contact.user_id, contact);
        });
    }

    // ИСПРАВЛЕНО: Обновление статуса одного контакта
    private updateSingleContactStatus(statusData: { user_id: number; status: 'online' | 'offline'; timestamp: string; last_seen: string | null }): void {
        const updatedContact: ContactStatus = {
            user_id: statusData.user_id,
            status: statusData.status,
            last_seen: statusData.last_seen // Используем last_seen напрямую из сообщения
        };

        this.onlineContacts.set(statusData.user_id, updatedContact);
    }

    // Получение текущих статусов контактов
    getContactsStatuses(): ContactStatus[] {
        return Array.from(this.onlineContacts.values());
    }

    // Получение статуса конкретного контакта
    getContactStatus(contactId: number): ContactStatus | null {
        return this.onlineContacts.get(contactId) || null;
    }

    // Получение только онлайн контактов
    getOnlineContacts(): ContactStatus[] {
        return this.getContactsStatuses().filter(contact => contact.status === 'online');
    }

    // Закрытие соединения
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        // Очищаем синглтон при явном отключении
        OnlineStatusClient.instance = null as any;
    }

    // Установка колбэков
    onStatusRegisteredCallback(callback: () => void): void {
        this.onStatusRegistered = callback;
    }

    onContactsUpdateCallback(callback: (contacts: ContactStatus[]) => void): void {
        this.onContactsUpdate = callback;
    }

    onContactStatusChangeCallback(callback: (contact: ContactStatus) => void): void {
        this.onContactStatusChange = callback;
    }

    onErrorCallback(callback: (error: string) => void): void {
        this.onError = callback;
    }

    onDisconnectedCallback(callback: () => void): void {
        this.onDisconnected = callback;
    }
}

export { OnlineStatusClient };
export type { ContactStatus };