export interface InboundMessage {
  channelId: string;
  userId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundMessage {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface SendContext {
  channelId?: string;
  [key: string]: unknown;
}

export interface ChannelAdapter {
  name: string;
  start(): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => void | Promise<void>): void;
  send(userId: string, reply: OutboundMessage, context?: SendContext): Promise<void>;
}
