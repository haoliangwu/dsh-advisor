/** `advisor` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'advisor.title': 'Advisor',
  'advisor.advice': '建议',
  'advisor.issues': '问题',
  'verdict.ok': '正常',
  'verdict.needs-attention': '需关注',
  'verdict.off-track': '已偏离',
} satisfies Record<string, string>

/** English dictionary mirroring the Chinese key set. */
export const en: Record<keyof typeof zh, string> = {
  'advisor.title': 'Advisor',
  'advisor.advice': 'Advice',
  'advisor.issues': 'Issues',
  'verdict.ok': 'OK',
  'verdict.needs-attention': 'Needs attention',
  'verdict.off-track': 'Off track',
}

/** The advisor namespace key union. */
export type AdvisorKey = keyof typeof zh
