window.__ModuleLoader__.load({
	id: "dsh-advisor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/Users/haoliang.wu/lyon/learn/dsh/dsh-advisor/src/client/AdvisorCard.module.css.mjs
		const css = "._9OqBDG_card{color:#1a3a5c;background:#e3eefc;border:1px solid #c3dbf5;border-radius:12px;flex-direction:column;gap:8px;width:100%;padding:12px 16px;display:flex}._9OqBDG_header{color:#3b6ea5;align-items:center;gap:8px;font-size:13px;font-weight:600;display:flex}._9OqBDG_icon{border-radius:999px;flex:none;justify-content:center;align-items:center;width:20px;height:20px;font-size:11px;line-height:1;display:inline-flex}._9OqBDG_iconOk{color:#3b6ea5;background:#d6e6fb;border:1px solid #b8d4f5}._9OqBDG_iconNeedsAttention{color:#2a5a8f;background:#c3dbf5;border:1px solid #a8c8ef}._9OqBDG_iconOffTrack{color:#fff;background:#8fb8e8;border:1px solid #6fa2de}._9OqBDG_verdict{text-transform:capitalize}._9OqBDG_turn{color:#5a7fae;margin-left:auto;font-size:12px;font-weight:400}._9OqBDG_issues{color:#2a4a6b;flex-direction:column;gap:4px;margin:0;padding-left:18px;font-size:13px;line-height:18px;display:flex}._9OqBDG_issueItem{list-style:outside}._9OqBDG_advice{color:#1a3a5c;background:#ffffff8c;border:1px solid #c3dbf5;border-radius:8px;padding:8px 10px;font-size:13px;line-height:18px}._9OqBDG_adviceLabel{color:#3b6ea5;margin-right:6px;font-weight:600}";
		const tagId = "dsh-advisor/AdvisorCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-advisor";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AdvisorCard_module_css_default = {
			"iconNeedsAttention": "_9OqBDG_iconNeedsAttention",
			"iconOffTrack": "_9OqBDG_iconOffTrack",
			"advice": "_9OqBDG_advice",
			"card": "_9OqBDG_card",
			"verdict": "_9OqBDG_verdict",
			"adviceLabel": "_9OqBDG_adviceLabel",
			"iconOk": "_9OqBDG_iconOk",
			"turn": "_9OqBDG_turn",
			"icon": "_9OqBDG_icon",
			"issues": "_9OqBDG_issues",
			"issueItem": "_9OqBDG_issueItem",
			"header": "_9OqBDG_header"
		};
		//#endregion
		//#region src/client/AdvisorCard.tsx
		/** Verdict icon characters within the blue family (no traffic-light colors). */
		function iconClass(verdict) {
			switch (verdict) {
				case "ok": return `${AdvisorCard_module_css_default.icon} ${AdvisorCard_module_css_default.iconOk}`;
				case "off-track": return `${AdvisorCard_module_css_default.icon} ${AdvisorCard_module_css_default.iconOffTrack}`;
				default: return `${AdvisorCard_module_css_default.icon} ${AdvisorCard_module_css_default.iconNeedsAttention}`;
			}
		}
		function iconChar(verdict) {
			switch (verdict) {
				case "ok": return "○";
				case "off-track": return "◉";
				default: return "◐";
			}
		}
		/**
		* Full-width淡蓝 advisor card. Verdict differentiation stays within the
		* harmonious blue palette (#e3eefc/#3b6ea5) via icon fill/border.
		*/
		const AdvisorCard = (0, react.memo)(function AdvisorCard({ node, t }) {
			const data = node.data;
			const verdictKey = `verdict.${data.verdict}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AdvisorCard_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdvisorCard_module_css_default.header,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: iconClass(data.verdict),
								"aria-hidden": true,
								children: iconChar(data.verdict)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AdvisorCard_module_css_default.verdict,
								children: t(verdictKey)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AdvisorCard_module_css_default.turn,
								children: ["# ", data.turn]
							})
						]
					}),
					data.issues.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: AdvisorCard_module_css_default.issues,
						"aria-label": t("advisor.issues"),
						children: data.issues.map((issue, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							className: AdvisorCard_module_css_default.issueItem,
							children: issue
						}, index))
					}),
					data.advice.trim().length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdvisorCard_module_css_default.advice,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: AdvisorCard_module_css_default.adviceLabel,
							children: [t("advisor.advice"), ":"]
						}), data.advice]
					})
				]
			});
		});
		//#endregion
		//#region src/client/advisor-definition.ts
		/** Business definition mapping `advisor/eval` events to `advisor` chat nodes. */
		const advisorDefinition = {
			kind: "advisor",
			target: "chat",
			match: (event) => {
				if (event.type !== "advisor/eval") return null;
				const turn = event.data.turn;
				return {
					id: String(turn),
					role: "start"
				};
			},
			start: (_context, match) => {
				if (match.event.type !== "advisor/eval") throw new Error("advisor start requires advisor/eval");
				return {
					data: match.event.data,
					seq: match.event.seq
				};
			},
			update: (context) => context.state,
			buildViewNode: (context) => {
				const state = context.state;
				if (state === void 0) return null;
				return {
					key: context.key,
					kind: "advisor",
					id: context.id,
					target: "chat",
					anchorSeq: state.seq,
					data: state.data,
					location: context.matches[0]?.location ?? { kind: "unresolved" },
					visibility: "visible"
				};
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** `advisor` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"advisor.title": "Advisor",
			"advisor.advice": "建议",
			"advisor.issues": "问题",
			"verdict.ok": "正常",
			"verdict.needs-attention": "需关注",
			"verdict.off-track": "已偏离"
		};
		/** English dictionary mirroring the Chinese key set. */
		const en = {
			"advisor.title": "Advisor",
			"advisor.advice": "Advice",
			"advisor.issues": "Issues",
			"verdict.ok": "OK",
			"verdict.needs-attention": "Needs attention",
			"verdict.off-track": "Off track"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "advisor";
		/** Required services: slot registry, locale, and conversation event registry. */
		const inject = [
			"slots",
			"locale",
			"conversationEvents"
		];
		/**
		* Client plugin body: register the dictionaries, the advisor conversation
		* node definition, and the `advisor` chat-node renderer.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "advisor: dictionaries");
			ctx.effect(() => ctx.conversationEvents.register(advisorDefinition), "advisor: conversation node");
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "advisor",
				locale: NS
			}, AdvisorCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map