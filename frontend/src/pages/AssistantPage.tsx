import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper, ChatMessage, Conversation } from '../types'
import { Send, Bot, User, BookOpen, Loader2, AlertCircle, ExternalLink, MessageSquare, Plus, Trash2 } from 'lucide-react'

const SUGGESTED_QUESTIONS = [
  'What are the main methodologies used in emotion recognition research?',
  'Summarize the key findings in the saved papers.',
  'What datasets are commonly used for facial expression recognition?',
  'What limitations are frequently reported in affective computing research?',
  'Compare the approaches used across the saved papers.',
  'What are potential future research directions based on these papers?',
]

export default function AssistantPage() {
  const { token } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextPapers, setContextPapers] = useState<Paper[]>([])
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<number>>(new Set())
  const [showContext, setShowContext] = useState(false)
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [showConvPanel, setShowConvPanel] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    api.get<Paper[]>('/api/library', token)
      .then(setContextPapers)
      .catch(() => {})
    api.get<{ available: boolean; model?: string }>('/api/assistant/status', token)
      .then((status) => setOllamaAvailable(status.available))
      .catch(() => setOllamaAvailable(false))
    loadConversations()
  }, [token])

  const loadConversations = async () => {
    if (!token) return
    try {
      const data = await api.get<Conversation[]>('/api/conversations', token)
      setConversations(data)
    } catch {}
  }

  const loadConversation = async (id: number) => {
    if (!token) return
    try {
      const data = await api.get<Conversation & { messages: ChatMessage[] }>(`/api/conversations/${id}`, token)
      setMessages(data.messages || [])
      setActiveConvId(id)
      setShowConvPanel(false)
    } catch {}
  }

  const deleteConversation = async (id: number) => {
    if (!token) return
    try {
      await api.delete<{ message: string }>(`/api/conversations/${id}`, token)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConvId === id) {
        setMessages([])
        setActiveConvId(null)
      }
    } catch {}
  }

  const startNewConversation = () => {
    setMessages([])
    setActiveConvId(null)
    setShowConvPanel(false)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const paperIds = Array.from(selectedPaperIds)
      const response = await api.post<ChatMessage & { conversation_id: number }>('/api/assistant/chat', {
        message: text,
        paper_ids: paperIds.length > 0 ? paperIds : null,
        conversation_id: activeConvId,
      }, token)
      setMessages((prev) => [...prev, response])
      // Update active conversation ID from response
      if (response.conversation_id && activeConvId !== response.conversation_id) {
        setActiveConvId(response.conversation_id)
        loadConversations()
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'The assistant encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const togglePaper = (id: number) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a' }}>
      {/* Conversation history panel */}
      {showConvPanel && (
        <div style={{
          width: 260, borderRight: '1px solid #1e293b',
          background: '#0b1120', display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: 0 }}>Conversations</h3>
            <button
              onClick={startNewConversation}
              style={{ padding: 5, borderRadius: 6, border: 'none', background: '#1e293b', color: '#93c5fd', cursor: 'pointer' }}
            >
              <Plus size={13} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {conversations.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 12, padding: '8px' }}>No conversations yet.</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                    borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                    background: activeConvId === conv.id ? '#1e293b' : 'transparent',
                    border: `1px solid ${activeConvId === conv.id ? '#2d3f5a' : 'transparent'}`,
                  }}
                >
                  <MessageSquare size={12} color="#64748b" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                    style={{ padding: 3, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Context panel */}
      <div style={{
        width: showContext ? 280 : 0,
        overflow: 'hidden',
        transition: 'width 0.2s',
        borderRight: '1px solid #1e293b',
        background: '#0b1120',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {showContext && (
          <>
            <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e293b' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Research Context</h3>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Select papers to include as context</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
              {contextPapers.length === 0 ? (
                <p style={{ color: '#475569', fontSize: 12, padding: '8px 8px' }}>
                  No saved papers. Save papers in your library to use as context.
                </p>
              ) : (
                contextPapers.map((paper) => paper.id && (
                  <label
                    key={paper.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px',
                      borderRadius: 8, cursor: 'pointer',
                      background: selectedPaperIds.has(paper.id) ? '#1e2d4a' : 'transparent',
                      marginBottom: 2,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaperIds.has(paper.id)}
                      onChange={() => paper.id && togglePaper(paper.id)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{paper.title}</span>
                  </label>
                ))
              )}
            </div>
            {selectedPaperIds.size > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #1e293b' }}>
                <span style={{ fontSize: 12, color: '#3b82f6' }}>
                  {selectedPaperIds.size} paper{selectedPaperIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0b1120',
        }}>
          <div>
            <h1 style={{ color: '#f8fafc', fontSize: 17, fontWeight: 600, margin: 0 }}>AI Research Assistant</h1>
            <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>
              {activeConvId ? `Conversation #${activeConvId}` : 'Ask questions about affective computing research'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {ollamaAvailable !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: ollamaAvailable ? '#10b981' : '#ef4444',
                }} />
                <span style={{ color: '#64748b' }}>
                  {ollamaAvailable ? 'Ollama connected' : 'Fallback mode'}
                </span>
              </div>
            )}
            <button
              onClick={() => { setShowConvPanel(!showConvPanel); if (showContext) setShowContext(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                borderRadius: 7, border: '1px solid', cursor: 'pointer', fontSize: 12,
                borderColor: showConvPanel ? '#3b82f6' : '#1e293b',
                background: showConvPanel ? '#1e3a5f' : 'transparent',
                color: showConvPanel ? '#93c5fd' : '#64748b',
              }}
            >
              <MessageSquare size={13} /> History
            </button>
            <button
              onClick={() => { setShowContext(!showContext); if (showConvPanel) setShowConvPanel(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                borderRadius: 7, border: '1px solid', cursor: 'pointer', fontSize: 12,
                borderColor: showContext ? '#3b82f6' : '#1e293b',
                background: showContext ? '#1e3a5f' : 'transparent',
                color: showContext ? '#93c5fd' : '#64748b',
              }}
            >
              <BookOpen size={13} />
              Context {selectedPaperIds.size > 0 ? `(${selectedPaperIds.size})` : ''}
            </button>
            {messages.length > 0 && (
              <button
                onClick={startNewConversation}
                style={{
                  padding: '6px 10px', borderRadius: 7, border: '1px solid #1e293b',
                  background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12,
                }}
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {messages.length === 0 && (
            <WelcomeState onSuggest={sendMessage} ollamaAvailable={ollamaAvailable} />
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #1e293b', background: '#0b1120' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about research methodologies, findings, comparisons..."
              disabled={loading}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 10,
                border: '1px solid #1e293b', background: '#0f172a',
                color: '#e2e8f0', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                padding: '12px 16px', borderRadius: 10, border: 'none',
                background: loading || !input.trim() ? '#334155' : '#3b82f6',
                color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
            </button>
          </div>
          <p style={{ color: '#334155', fontSize: 11, margin: '8px 0 0' }}>
            Responses are generated from your research library. Always verify claims against original sources.
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function WelcomeState({ onSuggest, ollamaAvailable }: { onSuggest: (q: string) => void; ollamaAvailable: boolean | null }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e2d4a, #1e1a3a)',
        border: '1px solid #2d3f5a', borderRadius: 16, padding: '32px', marginBottom: 24,
      }}>
        <Bot size={32} color="#3b82f6" style={{ marginBottom: 12 }} />
        <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          ARIS Research Assistant
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
          Ask questions about your saved research papers. I can help summarize findings, compare methodologies, identify limitations, and suggest future research directions.
        </p>
        {ollamaAvailable === false && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            borderRadius: 8, background: '#2a1a0d', border: '1px solid #451a03',
            color: '#fb923c', fontSize: 12, textAlign: 'left',
          }}>
            <AlertCircle size={14} />
            Ollama is not running. Responses will use rule-based extraction only. Install and start Ollama for AI-powered answers.
          </div>
        )}
      </div>
      <div style={{ textAlign: 'left' }}>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>Suggested questions:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1px solid #1e293b',
                background: '#0b1120', color: '#94a3b8', cursor: 'pointer',
                textAlign: 'left', fontSize: 13, lineHeight: 1.4,
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div style={{
      display: 'flex', gap: 12, marginBottom: 20,
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: isUser ? '#1e3a5f' : '#1a1a3a',
        border: '1px solid', borderColor: isUser ? '#2d5a8e' : '#2d2d5a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 2,
      }}>
        {isUser ? <User size={14} color="#93c5fd" /> : <Bot size={14} color="#a78bfa" />}
      </div>
      <div style={{
        maxWidth: '75%', padding: '12px 16px', borderRadius: 12,
        background: isUser ? '#1e2d4a' : '#0b1120',
        border: '1px solid', borderColor: isUser ? '#2d4a6a' : '#1e293b',
      }}>
        <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Sources:</div>
            {message.citations.map((c) => (
              <div key={c.paper_id} style={{ marginBottom: 4 }}>
                <span style={{ color: '#93c5fd', fontSize: 12 }}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none' }}>
                      {c.title} <ExternalLink size={10} style={{ display: 'inline' }} />
                    </a>
                  ) : c.title}
                </span>
                {c.year && <span style={{ color: '#475569', fontSize: 11 }}> ({c.year})</span>}
                {c.excerpt && (
                  <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                    "{c.excerpt}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ color: '#334155', fontSize: 10, marginTop: 6 }}>
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#1a1a3a', border: '1px solid #2d2d5a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bot size={14} color="#a78bfa" />
      </div>
      <div style={{
        padding: '12px 16px', borderRadius: 12,
        background: '#0b1120', border: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#475569',
            animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
    </div>
  )
}
