import { memo } from 'react'
import { DisclosureRow, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './AdvisorCard.module.css'

/** Props for the advisor card: one `advisor` chat node plus locale seat. */
type AdvisorCardProps = PropsRuntime<'conversation.chat.node', 'advisor'> & PropsLocale<'advisor'>

const VERDICT_CLASSES = {
  'ok': { dot: `${css.dot} ${css.dotOk}`, title: `${css.title} ${css.titleOk}` },
  'off-track': { dot: `${css.dot} ${css.dotOffTrack}`, title: `${css.title} ${css.titleOffTrack}` },
} as const

function verdictClasses(verdict: string): { dot: string; title: string } {
  return (VERDICT_CLASSES as Record<string, { dot: string; title: string }>)[verdict] ?? { dot: `${css.dot} ${css.dotNeedsAttention}`, title: `${css.title} ${css.titleNeedsAttention}` }
}

/**
 * Compact inset advisor card that shares the built-in conversation node
 * visual language: DisclosureRow header, semantic tokens, and MarkdownText body.
 */
export const AdvisorCard = memo(function AdvisorCard({ node, t }: AdvisorCardProps) {
  const data = node.data
  const verdictKey = `verdict.${data.verdict}` as const
  const classes = verdictClasses(data.verdict)
  return (
    <div className={css.root}>
      <DisclosureRow
        rowClassName={css.header}
        leadingClassName={css.leading}
        titleClassName={classes.title}
        icon={<span className={classes.dot} aria-hidden />}
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
