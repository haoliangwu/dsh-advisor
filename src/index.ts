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

/** Required services: session store and LLM streaming. */
export const inject = ['sessions', 'llm']

/** Default prompt template with `{turn}` and `{transcript}` placeholders. */
export const DEFAULT_PROMPT_TEMPLATE = [
  'You are a task advisor for an AI coding assistant. Evaluate the turn and return STRICT JSON only.',
  'Required JSON shape: {"verdict":"ok"|"needs-attention"|"off-track","issues":["..."],"advice":"..."}',
  '- verdict: ok = on track, needs-attention = minor issues, off-track = needs correction.',
  '- issues: concise list of problems or empty array.',
  '- advice: one short actionable suggestion in the same language as the transcript (Chinese if transcript is Chinese).',
  '',
  'Turn: {turn}',
  'Transcript (recent messages):',
  '{transcript}',
].join('\n')

/** Plugin config: when to evaluate and how to route the LLM call. */
export interface Config {
  /** Which turn/end reasons to evaluate (`error` default, or `all`). */
  evaluateOn?: string[]
  /** Optional explicit provider route; falls back to session's current model. */
  provider?: string
  /** Optional explicit model id; falls back to session's current model. */
  model?: string
  /** Optional prompt template with `{turn}` and `{transcript}` placeholders. */
  promptTemplate?: string
}

export const Config: z<Config> = z.object({
  evaluateOn: z.array(String).default(['error']),
  provider: z.string(),
  model: z.string(),
  promptTemplate: z.string(),
})

/** Valid verdict values the model may produce. */
const VERDICTS = new Set<AdvisorEvalData['verdict']>(['ok', 'needs-attention', 'off-track'])

/**
 * Host plugin body: listen to `session/event` for `turn/end`, filter by
 * `evaluateOn`, then stream an LLM evaluation and append `advisor/eval`.
 * @param ctx - host plugin context carrying sessions and llm services.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // oxlint-disable-next-line typescript/no-explicit-any -- cordis event map augmentation needs loose typing until tsc sees the declaration merge
  ;(ctx as any).on('session/event', (session: Session, event: SessionEvent) => {
    if (event.type !== 'turn/end') return
    const on = config.evaluateOn ?? ['error']
    const reasonKind = (event.data as { reason: { kind: string } }).reason.kind
    const should = on.includes('all') || on.includes(reasonKind)
    if (!should) return
    const turn = (event.data as { turn: number }).turn
    void evaluateTurn(ctx, config, session, turn).catch((error: unknown) => {
      ctx.logger.warn(`dsh-advisor: evaluation for turn ${turn} failed: ${String(error)}`)
    })
  })
}

/** Gather a text transcript of recent messages for the prompt. */
function buildTranscript(session: Session): string {
  try {
    const messages = session.deriveMessages()
    // Keep last 10 messages to bound input.
    const recent = messages.slice(-10)
    return recent.map((m: { role: string; content: { type: string; text?: string }[] }) => {
      const role = m.role
      const text = (m.content as { type: string; text?: string }[])
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('\n')
      const tool = (m.content as { type: string }[]).some((b) => b.type === 'tool-call' || b.type === 'tool-result') ? ' [tool]' : ''
      return `${role}${tool}: ${text.slice(0, 2000)}`
    }).join('\n\n') || '(no messages)'
  } catch {
    return '(transcript unavailable)'
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
  if (config.provider !== undefined || config.model !== undefined) {
    // Partial override: fill the other half from session header/context if possible.
    const header = session.requestHeader()
    const ctx = session.requestContext()
    const provider = config.provider ?? header?.config.provider ?? ctx?.provider
    const model = config.model ?? header?.config.model ?? ctx?.model
    if (provider !== undefined && model !== undefined) return { provider, model }
    return undefined
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
  // Try to locate JSON object if model wrapped it in markdown fences.
  const jsonText = (() => {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced?.[1] !== undefined) return fenced[1].trim()
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1)
    return trimmed
  })()
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const verdictRaw = typeof parsed.verdict === 'string' ? parsed.verdict : 'needs-attention'
    const verdict: AdvisorEvalData['verdict'] = VERDICTS.has(verdictRaw as AdvisorEvalData['verdict'])
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

/** Evaluate one turn via LLM and append the `advisor/eval` event. */
async function evaluateTurn(ctx: Context, config: Config, session: Session, turn: number): Promise<void> {
  const route = resolveRoute(config, session)
  if (route === undefined) {
    ctx.logger.warn(`dsh-advisor: skip turn ${turn} — no provider/model available (configure provider/model or ensure session has a request header)`)
    return
  }
  const template = config.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE
  const transcript = buildTranscript(session)
  const prompt = template.replaceAll('{turn}', String(turn)).replaceAll('{transcript}', transcript)
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
  const blocks = assembler.blocks() as { type: string; text?: string }[]
  const text = (blocks as { type: string; text: string }[])
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
  const parsed = parseEvalJson(text || '{}', turn)
  ;(session.append as any)('advisor/eval', parsed, { ignorable: true })
}
