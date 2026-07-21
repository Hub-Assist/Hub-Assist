import { SetMetadata } from '@nestjs/common';

export const AUDIT_EVENT_KEY = 'audit:event';

export const Audit = (eventType: string) => SetMetadata(AUDIT_EVENT_KEY, eventType);
