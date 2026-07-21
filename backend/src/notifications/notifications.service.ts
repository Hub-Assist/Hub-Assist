import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class NotificationsService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  sendToUser(userId: string, event: string, data: unknown) {
    this.server?.to(userId).emit(event, data);
  }

  sendToAll(event: string, data: unknown) {
    this.server?.emit(event, data);
  }
}
