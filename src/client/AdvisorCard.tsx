import { memo } from 'react'
import { DisclosureRow, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './AdvisorCard.module.css'

/** Props for the advisor card: one `advisor` chat node plus locale seat. */
type AdvisorCardProps = PropsRuntime<'conversation.chat.node', 'advisor'> & PropsLocale<'advisor'>

/** Leading verdict dot mapped to the blue family, same 10px halo style as StateDot. */
function dotClass(verdict: string): string {
  switch (verdict) {
    case 'ok': return `${css.dot} ${css.dotOk}`
    case 'off-track': return `${css.dot} ${css.dotOffTrack}`
    default: return `${css.dot} ${css.dotNeedsAttention}`
  }
}

function titleClass(verdict: string): string {
  switch (verdict) {
    case 'ok': return `${css.title} ${css.titleOk}`
    case 'off-track': return `${css.title} ${css.titleOffTrack}`
    default: return `${css.title} ${css.titleNeedsAttention}`
  }
}

/**
 * Compact inset advisor card that shares the built-in conversation node
 * visual language: DisclosureRow header, semantic tokens, and MarkdownText body.
 */
export const AdvisorCard = memo(function AdvisorCard({ node, t }: AdvisorCardProps) {
  const data = node.data
  const verdictKey = `verdict.${data.verdict}` as const
  return (
    <div className={css.root}>
      <DisclosureRow
        rowClassName={css.header}
        leadingClassName={css.leading}
        titleClassName={titleClass(data.verdict)}
        icon={<span className={dotClass(data.verdict)} aria-hidden />}
        title={t(verdictKey)}
        open={false}
        expandable={false}
        onToggle={() => {}}
        collapsedContent={(
          <>
            <span className={css.separator} aria-hidden />
            <span className={css.turn}># {data.turn}</span>
          </>
        )}
      />
      {data.issues.length > 0 && (
        <ul className={css.issues} aria-label={t('advisor.issues')}>
          {data.issues.map((issue, index) => (
            <li key={index} className={css.issue}>{issue}</li>
          ))}
        </ul>
      )}
      {data.advice.trim().length > 0 && (
        <div className={css.advice}>
          <span className={css.adviceLabel}>{t('advisor.advice')}:</span>
          <MarkdownText text={data.advice} />
        </div>
      )}
    </div>
  )
})
