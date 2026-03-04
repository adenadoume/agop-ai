import { Message, ModelId } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export interface StreamDelta {
  type: 'delta'
  text: string
}

export interface StreamDone {
  type: 'done'
  input_tokens: number
  output_tokens: number
  cost: number
  model: string
}

export interface StreamError {
  type: 'error'
  message: string
}

export type StreamEvent = StreamDelta | StreamDone | StreamError

export async function* streamChat(
  messages: Pick<Message, 'role' | 'content'>[],
  model: ModelId,
  conversationId: string,
  system?: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, conversation_id: conversationId, system }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as StreamEvent
          yield data
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}

export async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_message: firstMessage }),
    })
    const data = await res.json()
    return data.title || 'New Conversation'
  } catch {
    return 'New Conversation'
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
