import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Message } from '../types'

interface Props {
  message: Message & { streaming?: boolean }
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`message-row ${message.role}`}>
      <div className={`message-bubble ${message.role}`}>
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : message.streaming && !message.content ? (
          <div className="typing-dots">
            <span /><span /><span />
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const isBlock = match || String(children).includes('\n')
                if (isBlock) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match ? match[1] : 'text'}
                      PreTag="div"
                      customStyle={{ margin: 0, fontSize: '12px', borderRadius: '8px' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
                return <code className={className} {...props}>{children}</code>
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>

      {!message.streaming && (
        <div className="message-meta">
          {message.cost != null && message.cost > 0 && (
            <span className="message-cost-badge">${message.cost.toFixed(4)}</span>
          )}
          {message.model && !isUser && (
            <span>{message.model.includes('haiku') ? 'Haiku' : message.model.includes('opus') ? 'Opus' : 'Sonnet'}</span>
          )}
          {message.input_tokens != null && message.input_tokens > 0 && (
            <span>{message.input_tokens}↑ {message.output_tokens}↓</span>
          )}
        </div>
      )}
    </div>
  )
}
