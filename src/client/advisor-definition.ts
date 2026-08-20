import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { AdvisorEvalData } from '../types.ts'

interface AdvisorState {
  readonly data: AdvisorEvalData
  readonly seq: number
}

/** Business definition mapping `advisor/eval` events to `advisor` chat nodes. */
export const advisorDefinition: ConversationNodeDefinition<AdvisorState> = {
  kind: 'advisor',
  target: 'chat',
  match: (event) => {
    if (event.type !== 'advisor/eval') return null
    const turn = (event.data as AdvisorEvalData).turn
    return { id: String(turn), role: 'start' }
  },
  start: (_context, match) => {
    if (match.event.type !== 'advisor/eval') throw new Error('advisor start requires advisor/eval')
    return { data: match.event.data as AdvisorEvalData, seq: match.event.seq }
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
