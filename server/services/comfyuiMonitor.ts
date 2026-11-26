import type { Response } from 'express';
import type { ComfyExecutionEvent } from '../../src/types/studio';
import { buildComfyAuthHeaders, resolveComfyUrl } from './comfyuiProxy';
import { validateExternalServiceUrl } from './urlGuard';

interface MonitorChannel {
  key: string;
  baseUrl: string;
  clientId: string;
  ws: WebSocket | null;
  subscribers: Set<Response>;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  keepaliveTimer: ReturnType<typeof setInterval> | null;
  closedByClients: boolean;
}

const channels = new Map<string, MonitorChannel>();

function broadcast(channel: MonitorChannel, evt: ComfyExecutionEvent) {
  const payload = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of channel.subscribers) {
    try {
      res.write(payload);
    } catch {
      channel.subscribers.delete(res);
    }
  }
}

function toWebSocketUrl(baseHttpUrl: string, clientId: string): string {
  const parsed = new URL(baseHttpUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/ws`;
  parsed.search = new URLSearchParams({ clientId }).toString();
  return parsed.toString();
}

function connectWebSocket(channel: MonitorChannel) {
  if (channel.closedByClients || channel.subscribers.size === 0) return;

  const wsUrl = toWebSocketUrl(channel.baseUrl, channel.clientId);
  const authHeaders = buildComfyAuthHeaders();
  const hasAuth = Object.keys(authHeaders).length > 0;

  let socket: WebSocket;
  try {
    socket = hasAuth
      ? // Undici WebSocket in Node 22 supports { headers } via second options argument
        new (WebSocket as unknown as new (url: string, opts?: { headers?: Record<string, string> }) => WebSocket)(
          wsUrl,
          { headers: authHeaders }
        )
      : new WebSocket(wsUrl);
  } catch (err) {
    broadcast(channel, {
      type: 'disconnected',
      message: err instanceof Error ? err.message : 'Failed to initialize WebSocket connection',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  channel.ws = socket;

  socket.addEventListener('open', () => {
    channel.reconnectAttempts = 0;
    broadcast(channel, {
      type: 'connected',
      message: 'ComfyUI WebSocket stream connected',
      timestamp: new Date().toISOString(),
    });
  });

  socket.addEventListener('message', (msgEvent) => {
    if (typeof msgEvent.data !== 'string') return;
    try {
      const parsed = JSON.parse(msgEvent.data) as {
        type?: string;
        data?: {
          prompt_id?: string;
          node?: string | null;
          value?: number;
          max?: number;
          exception_message?: string;
          status?: { exec_info?: { queue_remaining?: number } };
        };
      };
      const type = parsed.type || 'status';
      const data = parsed.data || {};
      const timestamp = new Date().toISOString();

      if (type === 'status') {
        broadcast(channel, {
          type: 'status',
          queueRemaining: data.status?.exec_info?.queue_remaining,
          timestamp,
        });
      } else if (type === 'execution_start') {
        broadcast(channel, {
          type: 'execution_start',
          promptId: data.prompt_id,
          progressPercent: 20,
          timestamp,
        });
      } else if (type === 'executing') {
        broadcast(channel, {
          type: 'executing',
          promptId: data.prompt_id,
          node: data.node ?? null,
          timestamp,
        });
      } else if (type === 'progress') {
        const max = Number(data.max || 1);
        const value = Number(data.value || 0);
        const pct = max > 0 ? Math.min(98, Math.max(20, Math.round(20 + (value / max) * 75))) : 50;
        broadcast(channel, {
          type: 'progress',
          promptId: data.prompt_id,
          node: data.node ?? undefined,
          value,
          max,
          progressPercent: pct,
          timestamp,
        });
      } else if (type === 'executed') {
        broadcast(channel, {
          type: 'executed',
          promptId: data.prompt_id,
          node: data.node ?? undefined,
          timestamp,
        });
      } else if (type === 'execution_error') {
        broadcast(channel, {
          type: 'execution_error',
          promptId: data.prompt_id,
          node: data.node ?? undefined,
          message: data.exception_message || 'ComfyUI workflow execution error',
          timestamp,
        });
      } else if (type === 'execution_interrupted') {
        broadcast(channel, {
          type: 'execution_interrupted',
          promptId: data.prompt_id,
          message: 'ComfyUI execution interrupted',
          timestamp,
        });
      }
    } catch {
      // Ignore malformed frames
    }
  });

  socket.addEventListener('close', () => {
    channel.ws = null;
    if (channel.closedByClients || channel.subscribers.size === 0) return;

    broadcast(channel, {
      type: 'disconnected',
      message: 'ComfyUI WebSocket closed; attempting reconnect',
      timestamp: new Date().toISOString(),
    });

    if (channel.reconnectAttempts < 5) {
      channel.reconnectAttempts += 1;
      const delayMs = Math.min(8000, 1000 * channel.reconnectAttempts);
      channel.reconnectTimer = setTimeout(() => {
        connectWebSocket(channel);
      }, delayMs);
    }
  });

  socket.addEventListener('error', () => {
    // Error triggers close event which handles notification/backoff
  });
}

export function subscribeComfyEvents(rawUrl: string | undefined, clientId: string, res: Response) {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    res.status(400).json({ error: check.error || 'Invalid ComfyUI URL' });
    return;
  }

  const safeClientId = (clientId || 'neural-symphony-studio').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'studio';
  const key = `${check.normalizedUrl}::${safeClientId}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let channel = channels.get(key);
  if (!channel) {
    channel = {
      key,
      baseUrl: check.normalizedUrl,
      clientId: safeClientId,
      ws: null,
      subscribers: new Set(),
      reconnectAttempts: 0,
      reconnectTimer: null,
      keepaliveTimer: null,
      closedByClients: false,
    };
    channel.keepaliveTimer = setInterval(() => {
      for (const sub of channel!.subscribers) {
        try {
          sub.write(': keepalive\n\n');
        } catch {
          channel!.subscribers.delete(sub);
        }
      }
    }, 15000);
    channels.set(key, channel);
    connectWebSocket(channel);
  }

  channel.subscribers.add(res);
  res.write(
    `data: ${JSON.stringify({
      type: 'status',
      message: 'Subscribed to Studio execution bridge',
      timestamp: new Date().toISOString(),
    } satisfies ComfyExecutionEvent)}\n\n`
  );

  res.on('close', () => {
    const active = channels.get(key);
    if (!active) return;
    active.subscribers.delete(res);
    if (active.subscribers.size === 0) {
      active.closedByClients = true;
      if (active.reconnectTimer) clearTimeout(active.reconnectTimer);
      if (active.keepaliveTimer) clearInterval(active.keepaliveTimer);
      try {
        active.ws?.close();
      } catch {
        // Ignore close error
      }
      channels.delete(key);
    }
  });
}
