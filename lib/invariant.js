//#region src/invariant.ts
const PACKAGE_NAME = "dsh-advisor";
/** Cordis companion plugin name. */
const name = "advisor-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: host evaluation is fire-and-forget log-only, and the
* client advisor card is a pure conversation-node renderer whose disposal is
* owned by the slot / conversation-events registries.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns The installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
