import { memo } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './AdvisorCard.module.css'

/** Props for the advisor card: one `advisor` chat node plus locale seat. */
type AdvisorCardProps = PropsRuntime<'conversation.chat.node', 'advisor'> & PropsLocale<'advisor'>

/** Verdict icon characters within the blue family (no traffic-light colors). */
function iconClass(verdict: string): string {
  switch (verdict) {
    case 'ok': return `${css.icon} ${css.iconOk}`
    case 'off-track': return `${css.icon} ${css.iconOffTrack}`
    default: return `${css.icon} ${css.iconNeedsAttention}`
  }
}

function iconChar(verdict: string): string {
  switch (verdict) {
    case 'ok': return '○'
    case 'off-track': return '◉'
    default: return '◐'
  }
}

/**
 * Full-width淡蓝 advisor card. Verdict differentiation stays within the
 * harmonious blue palette (#e3eefc/#3b6ea5) via icon fill/border.
 */
export const AdvisorCard = memo(function AdvisorCard({ node, t }: AdvisorCardProps) {
  const data = node.data
  const verdictKey = `verdict.${data.verdict}` as const
  return (
    <div className={css.card}>
      <div className={css.header}>
        <span className={iconClass(data.verdict)} aria-hidden>{iconChar(data.verdict)}</span>
        <span className={css.verdict}>{t(verdictKey)}</span>
        <span className={css.turn}># {data.turn}</span>
      </div>
      {data.issues.length > 0 && (
        <ul className={css.issues} aria-label={t('advisor.issues')}>
          {data.issues.map((issue, index) => (
            <li key={index} className={css.issueItem}>{issue}</li>
          ))}
        </ul>
      )}
      {data.advice.trim().length > 0 && (
        <div className={css.advice}>
          <span className={css.adviceLabel}>{t('advisor.advice')}:</span>
          {data.advice}
        </div>
      )}
    </div>
  )
})
