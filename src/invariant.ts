/**
 * Package-owned invariant companion for `dsh-advisor`.
 * @module dsh-advisor/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-advisor'

/** Cordis companion plugin name. */
export const name = 'advisor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: host evaluation is fire-and-forget log-only, and the
 * client advisor card is a pure conversation-node renderer whose disposal is
 * owned by the slot / conversation-events registries.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
