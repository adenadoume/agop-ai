import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, message as antMessage } from 'antd'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { Conversation, Message, ModelId } from '../types'
import { supabase } from '../lib/supabase'
import { streamChat, generateTitle } from '../lib/api'
import MessageBubble from './MessageBubble'
import ModelSelector from './ModelSelector'

const { TextArea } = Input

interface Props {
  conversation: Conversation | null
  onConversationUpdate: (conv: Conversation) => void
  onTitleUpdate: (id: string, title: string) => void
}

type DisplayMessage = Message & { streaming?: boolean }

export default function ChatWindow({ conversation, onConversationUpdate, onTitleUpdate }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [model, setModel] = useState<ModelId>('claude-sonnet-4-6')
  const [sessionCost, setSessionCost] = useState(0)
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevConvId = useRef<string | null>(null)

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) { setMessages([]); setSessionCost(0); return }
    if (conversation.id === prevConvId.current) return
    prevConvId.current = conversation.id
    setSessionCost(0)
    setLoading(true)

    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setMessages(data as Message[])
        setLoading(false)
      })
  }, [conversation])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ESC to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) abortRef.current?.abort()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isStreaming])

  const sendMessage = useCallback(async () => {
    if (!conversation || !input.trim() || isStreaming) return

    const userContent = input.trim()
    setInput('')
    setIsStreaming(true)

    const tempUserId = `temp-user-${Date.now()}`
    const tempAsstId = `temp-asst-${Date.now()}`
    const now = new Date().toISOString()

    // Optimistic user message
    const userMsg: DisplayMessage = {
      id: tempUserId,
      conversation_id: conversation.id,
      role: 'user',
      content: userContent,
      created_at: now,
    }
    setMessages(prev => [...prev, userMsg, {
      id: tempAsstId,
      conversation_id: conversation.id,
      role: 'assistant',
      content: '',
      created_at: now,
      streaming: true,
    }])

    // Save user message to Supabase
    const { data: savedUser } = await supabase
      .from('messages')
      .insert({ conversation_id: conversation.id, role: 'user', content: userContent })
      .select().single()

    // Auto-generate title if first message
    if (messages.length === 0 && conversation.title === 'New Conversation') {
      generateTitle(userContent).then(title => {
        supabase.from('conversations').update({ title }).eq('id', conversation.id)
        onTitleUpdate(conversation.id, title)
      })
    }

    abortRef.current = new AbortController()
    let assistantContent = ''

    try {
      const allMsgs = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userContent },
      ]

      for await (const event of streamChat(allMsgs, model, conversation.id, undefined, abortRef.current.signal)) {
        if (event.type === 'delta') {
          assistantContent += event.text
          setMessages(prev => prev.map(m =>
            m.id === tempAsstId ? { ...m, content: assistantContent } : m
          ))
        } else if (event.type === 'done') {
          // Save assistant message
          const { data: savedAsst } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              role: 'assistant',
              content: assistantContent,
              model: event.model,
              input_tokens: event.input_tokens,
              output_tokens: event.output_tokens,
              cost: event.cost,
            })
            .select().single()

          // Update message with real data
          setMessages(prev => prev.map(m =>
            m.id === tempAsstId
              ? { ...(savedAsst as Message), streaming: false }
              : m.id === tempUserId
              ? { ...(savedUser as Message) }
              : m
          ))

          // Update conversation totals
          const updatedConv = {
            updated_at: now,
            total_cost: (conversation.total_cost || 0) + event.cost,
            total_input_tokens: (conversation.total_input_tokens || 0) + event.input_tokens,
            total_output_tokens: (conversation.total_output_tokens || 0) + event.output_tokens,
            message_count: (conversation.message_count || 0) + 2,
          }
          await supabase.from('conversations').update(updatedConv).eq('id', conversation.id)
          onConversationUpdate({ ...conversation, ...updatedConv })
          setSessionCost(prev => prev + event.cost)

        } else if (event.type === 'error') {
          antMessage.error(event.message)
          setMessages(prev => prev.filter(m => m.id !== tempAsstId))
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        antMessage.error('Stream failed. Check backend connection.')
        setMessages(prev => prev.filter(m => m.id !== tempAsstId))
      } else {
        // Aborted — keep partial response
        setMessages(prev => prev.map(m =>
          m.id === tempAsstId ? { ...m, streaming: false } : m
        ))
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [conversation, input, isStreaming, messages, model, onConversationUpdate, onTitleUpdate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!conversation) {
    return (
      <div className="chat-area">
        <div className="no-conversation">
          <div className="no-conversation-icon">◎</div>
          <div className="no-conversation-title">agop-ai</div>
          <div className="no-conversation-sub">Select a conversation or start a new chat</div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-header-title">{conversation.title}</div>
        <div className="chat-header-right">
          {sessionCost > 0 && (
            <span className="session-cost">Session: ${sessionCost.toFixed(4)}</span>
          )}
          <ModelSelector value={model} onChange={setModel} disabled={isStreaming} />
        </div>
      </div>

      <div className="messages-area">
        {loading && (
          <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">New conversation</div>
            <div className="empty-state-sub">Ask anything. Shift+Enter for new line.</div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message agop-ai... (Enter to send, Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 6 }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              className="cancel-btn"
              icon={<StopOutlined />}
              onClick={() => abortRef.current?.abort()}
              title="Cancel (ESC)"
            />
          ) : (
            <Button
              className="send-btn"
              icon={<SendOutlined />}
              onClick={sendMessage}
              disabled={!input.trim()}
            />
          )}
        </div>
        <div className="input-hint">ESC to cancel • Total: ${(conversation.total_cost || 0).toFixed(4)}</div>
      </div>
    </div>
  )
}
