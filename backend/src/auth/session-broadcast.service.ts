import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SessionEvent {
  type: 'session-revoked';
  userId: string;
  timestamp: Date;
}

@Injectable()
export class SessionBroadcastService {
  private sessionEvents = new Map<string, Subject<SessionEvent>>();

  /**
   * Get or create an SSE subject for a user.
   */
  getSessionEventStream(userId: string): Subject<SessionEvent> {
    if (!this.sessionEvents.has(userId)) {
      this.sessionEvents.set(userId, new Subject<SessionEvent>());
    }
    return this.sessionEvents.get(userId)!;
  }

  /**
   * Broadcast a session revocation event to a user.
   */
  broadcastSessionRevocation(userId: string): void {
    const subject = this.sessionEvents.get(userId);
    if (subject) {
      subject.next({
        type: 'session-revoked',
        userId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clean up SSE subject for a user.
   */
  cleanupSessionStream(userId: string): void {
    const subject = this.sessionEvents.get(userId);
    if (subject) {
      subject.complete();
      this.sessionEvents.delete(userId);
    }
  }
}
