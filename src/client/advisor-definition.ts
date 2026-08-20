import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { AdvisorEvalData } from '../types.ts'

interface AdvisorState {
  readonly data: AdvisorEvalData
  readonly seq: number
}

const PREFIX = '__advisor__'

function parseAdvisorData(event: { type: string; data: unknown }): AdvisorEvalData | null {
  if (event.type !== 'feedback/record') return null
  const text = (event.data as { text?: unknown }).text
  if (typeof text !== 'string' || !text.startsWith(PREFIX)) return null
  try {
    const parsed = JSON.parse(text.slice(PREFIX.length)) as Record<string, unknown>
    if (typeof parsed.turn !== 'number') return null
    if (typeof parsed.verdict !== 'string') return null
    if (typeof parsed.advice !== 'string') return null
    if (!Array.isArray(parsed.issues)) return null
    return parsed as unknown as AdvisorEvalData
  } catch {
    return null
  }
}

/** Business definition mapping `feedback/record` (advisor JSON-in-text) events to `advisor` chat nodes. */
export const advisorDefinition: ConversationNodeDefinition<AdvisorState> = {
  kind: 'advisor',
  target: 'chat',
  match: (event) => {
    const data = parseAdvisorData(event as { type: string; data: unknown })
    if (data === null) return null
    if (data.verdict === 'ok') return null
    return { id: String(data.turn), role: 'start' }
  },
  start: (_context, match) => {
    const data = parseAdvisorData(match.event as { type: string; data: unknown })
    if (data === null) throw new Error('advisor start requires feedback/record with __advisor__ prefix')
    return { data, seq: match.event.seq }
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    const state = context.state
    if (state === undefined) return null
    return {
      key: context.key,
      kind: 'advisor',
      id: context.id,
      target: 'chat',
      anchorSeq: state.seq,
      data: state.data,
      location: context.matches[0]?.location ?? { kind: 'unresolved' },
      visibility: 'visible' as const,
    }
  },
}
