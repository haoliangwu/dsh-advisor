/**
 * Shared type augmentations for dsh-advisor: session event map and chat node map.
 */

/** Payload logged by the host half and rendered by the browser half. */
export interface AdvisorEvalData {
  /** Turn that was evaluated. */
  turn: number
  /** Verdict within the blue-family palette (no traffic-light colors). */
  verdict: 'ok' | 'needs-attention' | 'off-track'
  /** Issue list extracted from the turn. */
  issues: string[]
  /** Actionable advice for the next step. */
  advice: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Log-only advisor evaluation for one turn (ignorable — reconstruction does not depend on it). */
    'advisor/eval': AdvisorEvalData
  }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Full-width淡蓝 advisor card rendered per evaluation. */
    advisor: AdvisorEvalData
  }
}
