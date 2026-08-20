/**
 * dsh-advisor, browser half: registers the `advisor` ConversationNodeDefinition
 * and its keyed `conversation.chat.node` renderer as a compact inset card.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge and ChatNodeViewProps contract.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { AdvisorCard } from './AdvisorCard.tsx'
import { advisorDefinition } from './advisor-definition.ts'
import { en, zh, type AdvisorKey } from './locales.ts'

export type { AdvisorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The advisor card copy. */
    advisor: AdvisorKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'advisor'

/** Required services: slot registry, locale, and conversation event registry. */
export const inject = ['slots', 'locale', 'conversationEvents']

/**
 * Client plugin body: register the dictionaries, the advisor conversation
 * node definition, and the `advisor` chat-node renderer.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'advisor: dictionaries')

  ctx.effect(() => ctx.conversationEvents.register(advisorDefinition), 'advisor: conversation node')

  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
    { name: 'conversation.chat.node', key: 'advisor', locale: NS },
    AdvisorCard,
  ))
}
