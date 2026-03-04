import { useState, useEffect, useCallback } from 'react'
import { ConfigProvider, Layout, theme } from 'antd'
import { Conversation } from './types'
import { supabase } from './lib/supabase'
import { checkHealth } from './lib/api'
import ConversationList from './components/ConversationList'
import ChatWindow from './components/ChatWindow'

const { Sider, Content } = Layout

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  // Load conversations
  useEffect(() => {
    supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setConversations(data as Conversation[])
      })
  }, [])

  // Check backend health
  useEffect(() => {
    checkHealth().then(setBackendOnline)
    const interval = setInterval(() => checkHealth().then(setBackendOnline), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleNew = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title: 'New Conversation', model: 'claude-sonnet-4-6' })
      .select().single()

    if (!error && data) {
      const conv = data as Conversation
      setConversations(prev => [conv, ...prev])
      setSelectedConv(conv)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (selectedConv?.id === id) setSelectedConv(null)
  }, [selectedConv])

  const handleConversationUpdate = useCallback((updated: Conversation) => {
    setConversations(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelectedConv(updated)
  }, [])

  const handleTitleUpdate = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    setSelectedConv(prev => prev?.id === id ? { ...prev, title } : prev)
  }, [])

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#8b5cf6',
          colorBgBase: '#0f172a',
          colorBgContainer: '#111827',
          colorBgElevated: '#1f2937',
          colorBorder: '#374151',
          colorText: '#e5e7eb',
          colorTextSecondary: '#9ca3af',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          borderRadius: 8,
          colorLink: '#a78bfa',
        },
        components: {
          Select: {
            optionSelectedBg: 'rgba(139,92,246,0.15)',
            colorBgContainer: '#1f2937',
            colorBorder: '#374151',
          },
          Input: {
            colorBgContainer: '#1f2937',
            colorBorder: '#374151',
            activeBorderColor: '#8b5cf6',
          },
          Button: {
            colorBgContainer: '#374151',
            colorBorder: '#4b5563',
          },
          Message: {
            colorBgElevated: '#1f2937',
          },
        },
      }}
    >
      <Layout className="app-layout">
        <Sider width={280} style={{ background: '#111827' }}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConv?.id ?? null}
            onSelect={setSelectedConv}
            onNew={handleNew}
            onDelete={handleDelete}
            backendOnline={backendOnline}
          />
        </Sider>
        <Content>
          <ChatWindow
            conversation={selectedConv}
            onConversationUpdate={handleConversationUpdate}
            onTitleUpdate={handleTitleUpdate}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
