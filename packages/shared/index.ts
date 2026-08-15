export interface ApiResponse<T = any> {
  status: boolean;
  code: number;
  message: string;
  result: T;
}

export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
}

export enum WhatsappStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
}
