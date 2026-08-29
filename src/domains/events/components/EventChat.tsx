'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { eventTimeOfDay } from '@/src/core/lib/dates'

export const EventMessagesQuery = gql`
  query EventMessagesQuery($eventId: ID!) {
    eventMessages(eventId: $eventId) {
      id
      body
      authorUsername
      createdAt
      isOwn
    }
  }
`

export const SendEventMessageMutation = gql`
  mutation SendEventMessageMutation($eventId: ID!, $body: String!) {
    sendEventMessage(eventId: $eventId, body: $body) {
      success
      error
    }
  }
`

export interface EventMessage {
  id: string
  body: string
  authorUsername: string | null
  createdAt: string
  isOwn: boolean
}

export interface EventChatProps {
  eventId: string
}

const MAX_BODY = 1000

export function EventChat({ eventId }: EventChatProps) {
  const [result, reexecuteQuery] = useQuery<{ eventMessages: EventMessage[] }>({
    query: EventMessagesQuery,
    variables: { eventId },
  })

  const [, sendMessage] = useMutation(SendEventMessageMutation)

  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const rawMessages = result.data?.eventMessages
  const messages = useMemo(() => rawMessages ?? [], [rawMessages])

  // Patrón oficial de React para derivar estado de props/query durante render sin refs
  const [prevMessages, setPrevMessages] = useState<EventMessage[]>(messages)
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(() => new Set())

  if (messages !== prevMessages) {
    setPrevMessages(messages)
    if (prevMessages.length > 0) {
      const prevSet = new Set(prevMessages.map((m) => m.id))
      const added = new Set(messages.filter((m) => !prevSet.has(m.id)).map((m) => m.id))
      if (added.size > 0) {
        setNewlyAddedIds(added)
      }
    }
  }

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef<boolean>(true)
  const isFirstLoadRef = useRef<boolean>(true)

  // Polling cada 5s cuando la pestaña está visible
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') {
        reexecuteQuery({ requestPolicy: 'network-only' })
      }
    }

    const intervalId = setInterval(poll, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reexecuteQuery({ requestPolicy: 'network-only' })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reexecuteQuery])

  // Auto-scroll si el usuario ya estaba al final o en la carga inicial
  useEffect(() => {
    if (messages.length === 0) return

    const container = messagesContainerRef.current
    if (container && (isFirstLoadRef.current || isAtBottomRef.current)) {
      container.scrollTop = container.scrollHeight
    }

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
    }
  }, [messages])

  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    const threshold = 50
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    isAtBottomRef.current = distanceFromBottom <= threshold
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (isPending) return

    const trimmed = body.trim()
    if (!trimmed) return

    setIsPending(true)
    setError(null)

    const res = await sendMessage({ eventId, body: trimmed })
    const { error: mutError } = unwrapMutation(res, 'sendEventMessage')
    setIsPending(false)

    if (mutError) {
      setError(mutError)
      return
    }

    setBody('')
    isAtBottomRef.current = true
    reexecuteQuery({ requestPolicy: 'network-only' })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter envía el mensaje
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-4 bg-ritual-surface border border-ritual-border p-4 md:p-6">
      {/* Lista de mensajes */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="max-h-80 overflow-y-auto space-y-3 pr-2"
      >
        {messages.length === 0 && !result.fetching ? (
          <p className="font-body text-sm italic text-ritual-gray-text py-4 text-center">
            No hay mensajes todavía. Escribí el primero para empezar a coordinar.
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.isOwn
            const authorName = isOwn ? 'Vos' : msg.authorUsername || 'Alguien'
            const timeLabel = eventTimeOfDay(msg.createdAt)
            const isNew = newlyAddedIds.has(msg.id)

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isOwn ? 'ml-auto items-end' : 'mr-auto items-start'} ${
                  isNew ? 'ritual-rise' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text">
                    {authorName}
                  </span>
                  <span className="font-label text-[9px] tracking-[0.1em] text-ritual-gray-mid">
                    {timeLabel}
                  </span>
                </div>
                <div
                  className={`px-4 py-2.5 font-body text-sm text-ritual-bone border ${
                    isOwn
                      ? 'bg-ritual-surface-high border-ritual-border-2 text-right'
                      : 'bg-ritual-panel border-ritual-border-subtle text-left'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Formulario de envío */}
      <form onSubmit={handleSubmit} className="space-y-2 border-t border-ritual-border-subtle pt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje..."
          rows={3}
          disabled={isPending}
          className="w-full border border-ritual-border bg-ritual-panel px-4 py-3 font-body text-sm text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40 resize-none disabled:opacity-50"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="font-label text-[10px] text-ritual-gray-text">
            {body.length}/{MAX_BODY}
          </p>

          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="ritual-cta bg-ritual-red text-ritual-bone px-5 py-2 font-label text-[10px] tracking-[0.14em] uppercase disabled:opacity-50"
          >
            {isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>

        {error && (
          <p role="alert" className="font-label text-xs text-ritual-red-hover mt-1">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
