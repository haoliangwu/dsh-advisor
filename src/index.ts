/**
 * dsh-advisor, host half: evaluates turn/error via LLM and appends `advisor/eval`
 * as a log-only session event. The browser half renders it as a full-width淡蓝 card.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session/types'
import z from '@deepseek-ai/schemastery'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { AdvisorEvalData } from './types.ts'
import type {} from './types.ts'

/** Cordis plugin name. */
export const name = 'dsh-advisor'

/** Required services: session store, agent registry, subagent runtime, and LLM streaming (fallback). */
export const inject = ['sessions', 'agents', 'subagents', 'llm']

/** Per-session last successful wake turn; used for cross-turn immuneTurns fuse (oh-my-pi advisor.immuneTurns:3). */
const lastWakeBySession = new Map<string, number>()

/** Default prompt template with `{turn}`, `{goal}` and `{transcript}` placeholders. */
export const DEFAULT_PROMPT_TEMPLATE = [
  'You are a senior task advisor. Decide if the turn advanced the user goal. Output JSON only, no markdown.',
  'Example: {"verdict":"needs-attention","issues":["file not found not handled"],"advice":"Run ls /tmp to verify path or ask user for correct file location"}',
  'Required JSON keys: verdict ("ok"|"needs-attention"|"off-track"), issues (string array), advice (one executable next step, same language as transcript).',
  '- ok = goal advanced or correctly handled with verification; needs-attention = gap; off-track = drift.',
  'Turn: {turn}',
  'Goal: {goal}',
  'Transcript:',
  '{transcript}',
  'JSON:',
].join('\n')

/** Plugin config: when to evaluate and how to route the LLM call. */
export interface Config {
  /** Optional explicit provider route; falls back to session's current model. */
  provider?: string
  /** Optional explicit model id; falls back to session's current model. */
  model?: string
  /** Optional prompt template with `{turn}` and `{transcript}` placeholders. */
  promptTemplate?: string
  /** When true, wake the main agent when advisor verdict is not `ok` (opt-in, default false). */
  autoContinue?: boolean
  /** Max advisor wakes per turn (1-5, default 1). */
  maxAdvisorRounds?: number
  /** Cross-turn downgrade: after a wake, next N primary turns skip wake even if verdict is needs-attention/off-track (0-10, default 3). */
  immuneTurns?: number
}

export const Config: z<Config> = z.object({
  provider: z.string(),
  model: z.string(),
  promptTemplate: z.string(),
  autoContinue: z.boolean().default(false),
  maxAdvisorRounds: z.number().step(1).min(1).max(5).default(1),
  immuneTurns: z.number().step(1).min(0).max(10).default(3),
})

/** Valid verdict values the model may produce. */
const VERDICTS = ['ok', 'needs-attention', 'off-track'] as const

/**
 * Host plugin body: listen to `session/event` for `turn/end` and evaluate every
 * turn via the advisor. History-based self-decision wake: advisor verdict drives
 * whether to continue.
 * @param ctx - host plugin context carrying sessions and llm services.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // Clean per-session immune state when session leaves the store.
  // oxlint-disable-next-line typescript/no-explicit-any -- cordis event map augmentation needs loose typing until tsc sees the declaration merge
  ;(ctx as any).on('session/disposed', (session: Session) => {
    lastWakeBySession.delete(session.id as unknown as string)
  })
  // oxlint-disable-next-line typescript/no-explicit-any -- cordis event map augmentation needs loose typing until tsc sees the declaration merge
  ;(ctx as any).on('session/event', (session: Session, event: SessionEvent) => {
    if (event.type !== 'turn/end') return
    const turn = (event.data as { turn: number }).turn
    void evaluateTurn(ctx, config, session, turn).catch((error: unknown) => {
      ctx.logger.warn(`dsh-advisor: evaluation for turn ${turn} failed: ${String(error)}`)
    })
  })
}

function textFromContent(content: unknown): string {
  return (content as { type: string; text?: string }[])
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
}

/** Gather a text transcript of recent messages for the prompt. */
function buildTranscript(session: Session): string {
  try {
    const messages = session.deriveMessages()
    // Keep last 10 messages to bound input.
    const recent = messages.slice(-10)
    return recent.map((m: { role: string; content: unknown }) => {
      const role = m.role
      const text = textFromContent(m.content)
      const tool = (m.content as { type: string }[]).some((b) => b.type === 'tool-call' || b.type === 'tool-result') ? ' [tool]' : ''
      return `${role}${tool}: ${text.slice(0, 2000)}`
    }).join('\n\n') || '(no messages)'
  } catch {
    return '(transcript unavailable)'
  }
}

/** First user message as goal (for target-contrast prompt). */
function buildGoal(session: Session): string {
  try {
    const messages = session.deriveMessages()
    const first = messages.find((m: { role: string }) => m.role === 'user')
    if (first === undefined) return '(no goal)'
    const text = textFromContent(first.content).slice(0, 2000)
    return text.trim() || '(empty goal)'
  } catch {
    return '(goal unavailable)'
  }
}

/** Resolve the LLM route: explicit config or session's last request header/context. */
function resolveRoute(
  config: Config,
  session: Session,
): { provider: string; model: string } | undefined {
  if (config.provider !== undefined && config.model !== undefined) {
    return { provider: config.provider, model: config.model }
  }
  const header = session.requestHeader()
  if (header?.config.provider !== undefined && header?.config.model !== undefined) {
    return { provider: header.config.provider, model: header.config.model }
  }
  const rc = session.requestContext()
  if (rc?.provider !== undefined && rc?.model !== undefined) {
    return { provider: rc.provider, model: rc.model }
  }
  return undefined
}

/** Parse model JSON into AdvisorEvalData, falling back gracefully. */
function parseEvalJson(raw: string, turn: number): AdvisorEvalData {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const jsonText = start !== -1 && end !== -1 && end > start ? trimmed.slice(start, end + 1) : trimmed
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const verdictRaw = typeof parsed.verdict === 'string' ? parsed.verdict : 'needs-attention'
    const verdict: AdvisorEvalData['verdict'] = (VERDICTS as readonly string[]).includes(verdictRaw)
      ? (verdictRaw as AdvisorEvalData['verdict'])
      : 'needs-attention'
    const issues = Array.isArray(parsed.issues)
      ? (parsed.issues as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 10)
      : []
    const advice = typeof parsed.advice === 'string' ? parsed.advice : trimmed.slice(0, 500)
    return { turn, verdict, issues, advice }
  } catch {
    return { turn, verdict: 'needs-attention', issues: ['Failed to parse advisor response'], advice: trimmed.slice(0, 800) }
  }
}

/** Pick a subagent provider that supports toolFilter, preferring fork > spawn. */
function pickSubagentProvider(ctx: Context): string | undefined {
  const subagents = (ctx as unknown as { subagents?: { getProvider?: (n: string) => unknown; list?: () => string[] } }).subagents
  if (subagents === undefined) return undefined
  if (typeof subagents.getProvider === 'function') {
    if (subagents.getProvider('fork') !== undefined) return 'fork'
    if (subagents.getProvider('spawn') !== undefined) return 'spawn'
  }
  if (typeof subagents.list === 'function') {
    const names = subagents.list()
    if (names.length > 0) return names[0]
  }
  return 'fork'
}

/** Collect text from ContentBlock array. */
function textFromBlocks(blocks: readonly { type: string; text?: string }[]): string {
  return blocks.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n')
}

/** Evaluate one turn via subagent sidecar (with LLM fallback) and append the `advisor/eval` event. */
async function evaluateTurn(ctx: Context, config: Config, session: Session, turn: number): Promise<void> {
  const route = resolveRoute(config, session)
  if (route === undefined) {
    ctx.logger.warn(`dsh-advisor: skip turn ${turn} — no provider/model available (configure provider/model or ensure session has a request header)`)
    return
  }
  const template = config.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE
  const transcript = buildTranscript(session)
  const goal = buildGoal(session)
  const prompt = template.replaceAll('{turn}', String(turn)).replaceAll('{goal}', goal).replaceAll('{transcript}', transcript)

  let text: string | undefined

  // Try subagent sidecar that reuses dsh tools (read/grep/glob) for verification.
  const agents = (ctx as unknown as { agents?: { get?: (id: unknown) => unknown; currentInitiator?: () => unknown } }).agents
  let parentAgent: unknown
  try {
    parentAgent = agents?.get?.(session.id) ?? agents?.currentInitiator?.()
  } catch {
    parentAgent = undefined
  }
  const subagents = (ctx as unknown as { subagents?: { start?: (name: string, req: unknown) => Promise<{ result: Promise<{ output: readonly { type: string; text?: string }[] }>; dispose: () => Promise<void> }> } }).subagents
  if (parentAgent !== undefined && parentAgent !== null && subagents?.start !== undefined) {
    const providerName = pickSubagentProvider(ctx)
    if (providerName !== undefined) {
      try {
        const signal = AbortSignal.timeout(30_000)
        const run = await subagents.start(providerName, {
          parent: parentAgent,
          prompt: [{ type: 'text', text: prompt }],
          toolFilter: { allow: ['read', 'grep', 'glob'] },
          maxDepth: 1,
          signal,
          label: 'advisor-eval',
          ...(route.provider !== undefined && route.model !== undefined ? { agentOptions: { provider: route.provider, model: route.model } } : {}),
        })
        try {
          const result = await run.result
          text = textFromBlocks(result.output as readonly { type: string; text?: string }[])
        } finally {
          await run.dispose().catch(() => {})
        }
      } catch (error: unknown) {
        ctx.logger.warn(`dsh-advisor: subagent sidecar failed for turn ${turn}, falling back to llm.stream: ${String(error)}`)
      }
    }
  }

  // Fallback: direct LLM stream (original path).
  if (text === undefined) {
    const messages = [createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: 'dsh-advisor' },
    })]
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream({
      provider: route.provider,
      model: route.model,
      messages,
      maxTokens: 512,
    })) {
      assembler.push(chunk)
    }
    const finish = assembler.finish
    if (finish !== undefined && finish.kind !== 'stop' && finish.kind !== 'tool-calls') {
      if (finish.kind === 'error' || finish.kind === 'aborted') {
        throw new Error(finish.failure.message)
      }
    }
    const blocks = assembler.blocks() as unknown
    text = textFromContent(blocks)
  }
  const parsed = parseEvalJson(text || '{}', turn)
  ;(session.append as any)('advisor/eval', parsed, { ignorable: true })

  // History-based self-decision wake: advisor verdict drives continuation.
  // Default passive (no wake) to avoid loop; opt-in via autoContinue.
  if (config.autoContinue !== true) return
  if (parsed.verdict === 'ok') return
  // Break condition 1: cap wakes per turn (prevents infinite retry if same turn re-evaluated).
  const count = session.events.filter((e) => e.type === 'advisor/eval' && (e.data as unknown as { turn: number }).turn === turn).length
  const maxRounds = config.maxAdvisorRounds ?? 1
  if (count >= maxRounds) {
    ctx.logger.info(`dsh-advisor: skip wake for turn ${turn} — maxAdvisorRounds ${maxRounds} reached (count=${count})`)
    return
  }
  // Cross-turn immuneTurns fuse (oh-my-pi advisor.immuneTurns:3): after a
  // successful wake, downgrade next N primary turns to aside (log but skip wake)
  // even if verdict is needs-attention/off-track.
  const last = lastWakeBySession.get(session.id as unknown as string)
  const immune = config.immuneTurns ?? 3
  if (last !== undefined && turn - last <= immune) {
    ctx.logger.info(`dsh-advisor: skip wake for turn ${turn} — immuneTurns ${immune} (last wake turn ${last})`)
    return
  }
  const adviceText = `Advisor (turn ${turn} ${parsed.verdict}): ${parsed.advice}${parsed.issues.length > 0 ? `\nIssues: ${parsed.issues.join('; ')}` : ''}`
  const wakeMessage = createUserMessage({
    content: [{ type: 'text', text: adviceText }],
    source: { kind: 'plugin', plugin: 'dsh-advisor' },
  })
  ;(session.append as any)('user/message', wakeMessage, { surfaceOp: 'append' })
  lastWakeBySession.set(session.id as unknown as string, turn)
  ctx.logger.info(`dsh-advisor: waking main agent for turn ${turn} → next turn with advisor advice`)
}
