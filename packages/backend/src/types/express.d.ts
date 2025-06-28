import { User } from '@gemini-cli-webui/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      requestId?: string;
    }
  }
}

export {};