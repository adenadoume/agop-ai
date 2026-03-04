import { useState } from 'react'
import { Button, Input } from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import { Conversation } from '../types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface Props {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onNew: () => void
  onDelete: (id: string) => void
  backendOnline: boolean | null
}

export default function ConversationList({
  conversations, selectedId, onSelect, onNew, onDelete, backendOnline
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">agop-ai</div>
        <Button
          className="new-chat-btn"
          icon={<PlusOutlined />}
          onClick={onNew}
        >
          New Chat
        </Button>
      </div>

      <div className="sidebar-search">
        <Input
          placeholder="Search conversations..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
      </div>

      <div className="sidebar-list">
        {filtered.length === 0 && (
          <div style={{ padding: '20px 12px', color: '#4b5563', fontSize: 13, textAlign: 'center' }}>
            {search ? 'No results' : 'No conversations yet'}
          </div>
        )}
        {filtered.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(conv)}
          >
            <div className="conv-title">
              <MessageOutlined style={{ fontSize: 11, marginRight: 5, opacity: 0.5 }} />
              {conv.title}
            </div>
            <div className="conv-meta">
              <span>{dayjs(conv.updated_at).fromNow()}</span>
              <span className="conv-cost">
                {conv.total_cost > 0 ? `$${conv.total_cost.toFixed(4)}` : ''}
              </span>
            </div>
            <Button
              className="conv-delete-btn"
              size="small"
              icon={<DeleteOutlined />}
              onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
            />
          </div>
        ))}
      </div>

      <div className="backend-status">
        <div className={`status-dot ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : ''}`} />
        <span>
          {backendOnline === true ? 'Backend online' : backendOnline === false ? 'Backend offline' : 'Checking...'}
        </span>
      </div>
    </div>
  )
}
