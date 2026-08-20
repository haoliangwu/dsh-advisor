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

// Advisor evals are stored as `feedback/record` with JSON-in-text and `__advisor__` marker prefix
// to avoid a main-repo SessionEvent patch. The ChatNodeDataMap `advisor` remains the view kind.
// Local SessionEventMap augmentation for `feedback/record` keeps `tsc --noEmit` aware when the
// host's command-feedback types are not on the synthetic profile path; at runtime the host already knows it.
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'feedback/record': { text: string }
  }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Compact inset advisor card rendered per evaluation. */
    advisor: AdvisorEvalData
  }
}
