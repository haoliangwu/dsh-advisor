import z from "@deepseek-ai/schemastery";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/index.ts
/** Cordis plugin name. */
const name = "dsh-advisor";
/** Required services: session store and LLM streaming. */
const inject = ["sessions", "llm"];
/** Default prompt template with `{turn}` and `{transcript}` placeholders. */
const DEFAULT_PROMPT_TEMPLATE = [
	"You are a task advisor for an AI coding assistant. Evaluate the turn and return STRICT JSON only.",
	"Required JSON shape: {\"verdict\":\"ok\"|\"needs-attention\"|\"off-track\",\"issues\":[\"...\"],\"advice\":\"...\"}",
	"- verdict: ok = on track, needs-attention = minor issues, off-track = needs correction.",
	"- issues: concise list of problems or empty array.",
	"- advice: one short actionable suggestion in the same language as the transcript (Chinese if transcript is Chinese).",
	"",
	"Turn: {turn}",
	"Transcript (recent messages):",
	"{transcript}"
].join("\n");
const Config = z.object({
	evaluateOn: z.array(String).default(["error"]),
	provider: z.string(),
	model: z.string(),
	promptTemplate: z.string(),
	autoContinue: z.boolean().default(false),
	maxAdvisorRounds: z.number().step(1).min(1).max(5).default(1)
});
/** Valid verdict values the model may produce. */
const VERDICTS = /* @__PURE__ */ new Set([
	"ok",
	"needs-attention",
	"off-track"
]);
/**
* Host plugin body: listen to `session/event` for `turn/end`, filter by
* `evaluateOn`, then stream an LLM evaluation and append `advisor/eval`.
* @param ctx - host plugin context carrying sessions and llm services.
* @param config - validated plugin config.
*/
function apply(ctx, config) {
	ctx.on("session/event", (session, event) => {
		if (event.type === "turn/end") {
			const on = config.evaluateOn ?? ["error"];
			const reasonKind = event.data.reason.kind;
			if (!(on.includes("all") || on.includes(reasonKind))) return;
			const turn = event.data.turn;
			evaluateTurn(ctx, config, session, turn, reasonKind).catch((error) => {
				ctx.logger.warn(`dsh-advisor: evaluation for turn ${turn} failed: ${String(error)}`);
			});
			return;
		}
		if (event.type === "user/message") {
			if (event.data.message?.content?.filter((b) => b.type === "text").map((b) => b.text).join("").trim() !== "/test-error") return;
			const turn = session.events.filter((e) => e.type === "turn/start").length + 1;
			try {
				session.append("turn/start", { turn });
				session.append("turn/end", {
					turn,
					reason: {
						kind: "error",
						error: {
							message: "synthetic test error: file not found",
							code: "TEST_ERROR"
						}
					}
				});
			} catch (error) {
				ctx.logger.warn(`dsh-advisor: synthetic error inject failed: ${String(error)}`);
			}
		}
	});
}
/** Gather a text transcript of recent messages for the prompt. */
function buildTranscript(session) {
	try {
		return session.deriveMessages().slice(-10).map((m) => {
			const role = m.role;
			const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
			return `${role}${m.content.some((b) => b.type === "tool-call" || b.type === "tool-result") ? " [tool]" : ""}: ${text.slice(0, 2e3)}`;
		}).join("\n\n") || "(no messages)";
	} catch {
		return "(transcript unavailable)";
	}
}
/** Resolve the LLM route: explicit config or session's last request header/context. */
function resolveRoute(config, session) {
	if (config.provider !== void 0 && config.model !== void 0) return {
		provider: config.provider,
		model: config.model
	};
	if (config.provider !== void 0 || config.model !== void 0) {
		const header = session.requestHeader();
		const ctx = session.requestContext();
		const provider = config.provider ?? header?.config.provider ?? ctx?.provider;
		const model = config.model ?? header?.config.model ?? ctx?.model;
		if (provider !== void 0 && model !== void 0) return {
			provider,
			model
		};
		return;
	}
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
	const jsonText = (() => {
		const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (fenced?.[1] !== void 0) return fenced[1].trim();
		const start = trimmed.indexOf("{");
		const end = trimmed.lastIndexOf("}");
		if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1);
		return trimmed;
	})();
	try {
		const parsed = JSON.parse(jsonText);
		const verdictRaw = typeof parsed.verdict === "string" ? parsed.verdict : "needs-attention";
		return {
			turn,
			verdict: VERDICTS.has(verdictRaw) ? verdictRaw : "needs-attention",
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
/** Evaluate one turn via LLM and append the `advisor/eval` event. */
async function evaluateTurn(ctx, config, session, turn, reasonKind) {
	const route = resolveRoute(config, session);
	if (route === void 0) {
		ctx.logger.warn(`dsh-advisor: skip turn ${turn} — no provider/model available (configure provider/model or ensure session has a request header)`);
		return;
	}
	const template = config.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;
	const transcript = buildTranscript(session);
	const prompt = template.replaceAll("{turn}", String(turn)).replaceAll("{transcript}", transcript);
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
	const parsed = parseEvalJson(assembler.blocks().filter((b) => b.type === "text").map((b) => b.text).join("") || "{}", turn);
	session.append("advisor/eval", parsed, { ignorable: true });
	if (config.autoContinue !== true) return;
	if (reasonKind !== "error") return;
	const count = session.events.filter((e) => e.type === "advisor/eval" && e.data.turn === turn).length;
	const maxRounds = config.maxAdvisorRounds ?? 1;
	if (count >= maxRounds) {
		ctx.logger.info(`dsh-advisor: skip wake for turn ${turn} — maxAdvisorRounds ${maxRounds} reached (count=${count})`);
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
	ctx.logger.info(`dsh-advisor: waking main agent for turn ${turn} → next turn with advisor advice`);
}
//#endregion
export { Config, DEFAULT_PROMPT_TEMPLATE, apply, inject, name };
