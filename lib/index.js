import z from "@deepseek-ai/schemastery";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/index.ts
/** Cordis plugin name. */
const name = "dsh-advisor";
/** Required services: session store, agent registry, subagent runtime, and LLM streaming (fallback). */
const inject = [
	"sessions",
	"agents",
	"subagents",
	"llm"
];
/** Per-session last successful wake turn; used for cross-turn immuneTurns fuse (oh-my-pi advisor.immuneTurns:3). */
const lastWakeBySession = /* @__PURE__ */ new Map();
/** Default prompt template with `{turn}`, `{goal}` and `{transcript}` placeholders. */
const DEFAULT_PROMPT_TEMPLATE = [
	"You are a senior task advisor. Decide if the turn advanced the user goal. Output JSON only, no markdown.",
	"Example: {\"verdict\":\"needs-attention\",\"issues\":[\"file not found not handled\"],\"advice\":\"Run ls /tmp to verify path or ask user for correct file location\"}",
	"Required JSON keys: verdict (\"ok\"|\"needs-attention\"|\"off-track\"), issues (string array), advice (one executable next step, same language as transcript).",
	"- ok = goal advanced or correctly handled with verification; needs-attention = gap; off-track = drift.",
	"Turn: {turn}",
	"Goal: {goal}",
	"Transcript:",
	"{transcript}",
	"JSON:"
].join("\n");
const Config = z.object({
	provider: z.string(),
	model: z.string(),
	promptTemplate: z.string(),
	autoContinue: z.boolean().default(false),
	maxAdvisorRounds: z.number().step(1).min(1).max(5).default(1),
	immuneTurns: z.number().step(1).min(0).max(10).default(3)
});
/** Valid verdict values the model may produce. */
const VERDICTS = [
	"ok",
	"needs-attention",
	"off-track"
];
/**
* Host plugin body: listen to `session/event` for `turn/end` and evaluate every
* turn via the advisor. History-based self-decision wake: advisor verdict drives
* whether to continue.
* @param ctx - host plugin context carrying sessions and llm services.
* @param config - validated plugin config.
*/
function apply(ctx, config) {
	ctx.on("session/disposed", (session) => {
		lastWakeBySession.delete(session.id);
	});
	ctx.on("session/event", (session, event) => {
		if (event.type !== "turn/end") return;
		const turn = event.data.turn;
		evaluateTurn(ctx, config, session, turn).catch((error) => {
			ctx.logger.warn(`dsh-advisor: evaluation for turn ${turn} failed: ${String(error)}`);
		});
	});
}
function textFromContent(content) {
	return content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
/** Gather a text transcript of recent messages for the prompt. */
function buildTranscript(session) {
	try {
		return session.deriveMessages().slice(-10).map((m) => {
			const role = m.role;
			const text = textFromContent(m.content);
			return `${role}${m.content.some((b) => b.type === "tool-call" || b.type === "tool-result") ? " [tool]" : ""}: ${text.slice(0, 2e3)}`;
		}).join("\n\n") || "(no messages)";
	} catch {
		return "(transcript unavailable)";
	}
}
/** First user message as goal (for target-contrast prompt). */
function buildGoal(session) {
	try {
		const first = session.deriveMessages().find((m) => m.role === "user");
		if (first === void 0) return "(no goal)";
		return textFromContent(first.content).slice(0, 2e3).trim() || "(empty goal)";
	} catch {
		return "(goal unavailable)";
	}
}
/** Resolve the LLM route: explicit config or session's last request header/context. */
function resolveRoute(config, session) {
	if (config.provider !== void 0 && config.model !== void 0) return {
		provider: config.provider,
		model: config.model
	};
	const header = session.requestHeader();
	if (header?.config.provider !== void 0 && header?.config.model !== void 0) return {
		provider: header.config.provider,
		model: header.config.model
	};
	const rc = session.requestContext();
	if (rc?.provider !== void 0 && rc?.model !== void 0) return {
		provider: rc.provider,
		model: rc.model
	};
}
/** Parse model JSON into AdvisorEvalData, falling back gracefully. */
function parseEvalJson(raw, turn) {
	const trimmed = raw.trim();
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	const jsonText = start !== -1 && end !== -1 && end > start ? trimmed.slice(start, end + 1) : trimmed;
	try {
		const parsed = JSON.parse(jsonText);
		const verdictRaw = typeof parsed.verdict === "string" ? parsed.verdict : "needs-attention";
		return {
			turn,
			verdict: VERDICTS.includes(verdictRaw) ? verdictRaw : "needs-attention",
			issues: Array.isArray(parsed.issues) ? parsed.issues.filter((v) => typeof v === "string").slice(0, 10) : [],
			advice: typeof parsed.advice === "string" ? parsed.advice : trimmed.slice(0, 500)
		};
	} catch {
		return {
			turn,
			verdict: "needs-attention",
			issues: ["Failed to parse advisor response"],
			advice: trimmed.slice(0, 800)
		};
	}
}
/** Pick a subagent provider that supports toolFilter, preferring fork > spawn. */
function pickSubagentProvider(ctx) {
	const subagents = ctx.subagents;
	if (subagents === void 0) return void 0;
	if (typeof subagents.getProvider === "function") {
		if (subagents.getProvider("fork") !== void 0) return "fork";
		if (subagents.getProvider("spawn") !== void 0) return "spawn";
	}
	if (typeof subagents.list === "function") {
		const names = subagents.list();
		if (names.length > 0) return names[0];
	}
	return "fork";
}
/** Collect text from ContentBlock array. */
function textFromBlocks(blocks) {
	return blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
}
/** Evaluate one turn via subagent sidecar (with LLM fallback) and append the `advisor/eval` event. */
async function evaluateTurn(ctx, config, session, turn) {
	const route = resolveRoute(config, session);
	if (route === void 0) {
		ctx.logger.warn(`dsh-advisor: skip turn ${turn} — no provider/model available (configure provider/model or ensure session has a request header)`);
		return;
	}
	const template = config.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;
	const transcript = buildTranscript(session);
	const goal = buildGoal(session);
	const prompt = template.replaceAll("{turn}", String(turn)).replaceAll("{goal}", goal).replaceAll("{transcript}", transcript);
	let text;
	const agents = ctx.agents;
	let parentAgent;
	try {
		parentAgent = agents?.get?.(session.id) ?? agents?.currentInitiator?.();
	} catch {
		parentAgent = void 0;
	}
	const subagents = ctx.subagents;
	if (parentAgent !== void 0 && parentAgent !== null && subagents?.start !== void 0) {
		const providerName = pickSubagentProvider(ctx);
		if (providerName !== void 0) try {
			const signal = AbortSignal.timeout(3e4);
			const run = await subagents.start(providerName, {
				parent: parentAgent,
				prompt: [{
					type: "text",
					text: prompt
				}],
				toolFilter: { allow: [
					"read",
					"grep",
					"glob"
				] },
				maxDepth: 1,
				signal,
				label: "advisor-eval",
				...route.provider !== void 0 && route.model !== void 0 ? { agentOptions: {
					provider: route.provider,
					model: route.model
				} } : {}
			});
			try {
				text = textFromBlocks((await run.result).output);
			} finally {
				await run.dispose().catch(() => {});
			}
		} catch (error) {
			ctx.logger.warn(`dsh-advisor: subagent sidecar failed for turn ${turn}, falling back to llm.stream: ${String(error)}`);
		}
	}
	if (text === void 0) {
		const messages = [createUserMessage({
			content: [{
				type: "text",
				text: prompt
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-advisor"
			}
		})];
		const assembler = new BlockAssembler();
		for await (const chunk of ctx.llm.stream({
			provider: route.provider,
			model: route.model,
			messages,
			maxTokens: 512
		})) assembler.push(chunk);
		const finish = assembler.finish;
		if (finish !== void 0 && finish.kind !== "stop" && finish.kind !== "tool-calls") {
			if (finish.kind === "error" || finish.kind === "aborted") throw new Error(finish.failure.message);
		}
		text = textFromContent(assembler.blocks());
	}
	const parsed = parseEvalJson(text || "{}", turn);
	session.append("advisor/eval", parsed, { ignorable: true });
	if (config.autoContinue !== true) return;
	if (parsed.verdict === "ok") return;
	const count = session.events.filter((e) => e.type === "advisor/eval" && e.data.turn === turn).length;
	const maxRounds = config.maxAdvisorRounds ?? 1;
	if (count >= maxRounds) {
		ctx.logger.info(`dsh-advisor: skip wake for turn ${turn} — maxAdvisorRounds ${maxRounds} reached (count=${count})`);
		return;
	}
	const last = lastWakeBySession.get(session.id);
	const immune = config.immuneTurns ?? 3;
	if (last !== void 0 && turn - last <= immune) {
		ctx.logger.info(`dsh-advisor: skip wake for turn ${turn} — immuneTurns ${immune} (last wake turn ${last})`);
		return;
	}
	const adviceText = `Advisor (turn ${turn} ${parsed.verdict}): ${parsed.advice}${parsed.issues.length > 0 ? `\nIssues: ${parsed.issues.join("; ")}` : ""}`;
	const wakeMessage = createUserMessage({
		content: [{
			type: "text",
			text: adviceText
		}],
		source: {
			kind: "plugin",
			plugin: "dsh-advisor"
		}
	});
	session.append("user/message", wakeMessage, { surfaceOp: "append" });
	lastWakeBySession.set(session.id, turn);
	ctx.logger.info(`dsh-advisor: waking main agent for turn ${turn} → next turn with advisor advice`);
}
//#endregion
export { Config, DEFAULT_PROMPT_TEMPLATE, apply, inject, name };
