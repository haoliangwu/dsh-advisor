window.__ModuleLoader__.load({
	id: "dsh-advisor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/Users/haoliang.wu/lyon/learn/dsh/dsh-advisor/src/client/AdvisorCard.module.css.mjs
		const css = "._9OqBDG_root{border:1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 16%, transparent);background:var(--dsw-alias-state-business-tertiary);border-radius:12px;flex-direction:column;gap:8px;padding:10px 12px;display:flex}._9OqBDG_header{height:24px}._9OqBDG_leading{width:16px;height:16px;margin-right:6px}._9OqBDG_dot{width:10px;height:10px;color:var(--dsw-alias-state-business-primary);border-radius:50%;display:inline-block;position:relative}._9OqBDG_dot:before{content:\"\";opacity:.1;background:currentColor;border-radius:50%;position:absolute;inset:0}._9OqBDG_dot:after{content:\"\";background:currentColor;border-radius:50%;position:absolute;inset:20%}._9OqBDG_dotOk{color:var(--dsw-static-deepseek-400)}._9OqBDG_dotNeedsAttention{color:var(--dsw-static-deepseek-500)}._9OqBDG_dotOffTrack{color:var(--dsw-static-deepseek-600)}._9OqBDG_title{color:var(--dsw-alias-state-business-primary);font-weight:500}._9OqBDG_titleOk._9OqBDG_title{color:var(--dsw-static-deepseek-400)}._9OqBDG_titleNeedsAttention._9OqBDG_title{color:var(--dsw-static-deepseek-500)}._9OqBDG_titleOffTrack._9OqBDG_title{color:var(--dsw-static-deepseek-600)}._9OqBDG_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}._9OqBDG_turn{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:18px}._9OqBDG_issues{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;margin:0;padding-left:22px;font-size:13px;line-height:20px;display:flex}._9OqBDG_issue{list-style:outside}._9OqBDG_issue::marker{color:var(--dsw-alias-label-caption)}._9OqBDG_advice{color:var(--dsw-alias-label-primary);padding-left:22px}._9OqBDG_adviceLabel{color:var(--dsw-alias-state-business-primary);margin-bottom:4px;font-size:12px;font-weight:600;line-height:18px;display:block}";
		const tagId = "dsh-advisor/AdvisorCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-advisor";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AdvisorCard_module_css_default = {
			"leading": "_9OqBDG_leading",
			"dotNeedsAttention": "_9OqBDG_dotNeedsAttention",
			"title": "_9OqBDG_title",
			"issue": "_9OqBDG_issue",
			"adviceLabel": "_9OqBDG_adviceLabel",
			"issues": "_9OqBDG_issues",
			"dot": "_9OqBDG_dot",
			"header": "_9OqBDG_header",
			"advice": "_9OqBDG_advice",
			"root": "_9OqBDG_root",
			"titleNeedsAttention": "_9OqBDG_titleNeedsAttention",
			"dotOk": "_9OqBDG_dotOk",
			"titleOk": "_9OqBDG_titleOk",
			"dotOffTrack": "_9OqBDG_dotOffTrack",
			"titleOffTrack": "_9OqBDG_titleOffTrack",
			"separator": "_9OqBDG_separator",
			"turn": "_9OqBDG_turn"
		};
		//#endregion
		//#region src/client/AdvisorCard.tsx
		/** Leading verdict dot mapped to the blue family, same 10px halo style as StateDot. */
		function dotClass(verdict) {
			switch (verdict) {
				case "ok": return `${AdvisorCard_module_css_default.dot} ${AdvisorCard_module_css_default.dotOk}`;
				case "off-track": return `${AdvisorCard_module_css_default.dot} ${AdvisorCard_module_css_default.dotOffTrack}`;
				default: return `${AdvisorCard_module_css_default.dot} ${AdvisorCard_module_css_default.dotNeedsAttention}`;
			}
		}
		function titleClass(verdict) {
			switch (verdict) {
				case "ok": return `${AdvisorCard_module_css_default.title} ${AdvisorCard_module_css_default.titleOk}`;
				case "off-track": return `${AdvisorCard_module_css_default.title} ${AdvisorCard_module_css_default.titleOffTrack}`;
				default: return `${AdvisorCard_module_css_default.title} ${AdvisorCard_module_css_default.titleNeedsAttention}`;
			}
		}
		/**
		* Compact inset advisor card that shares the built-in conversation node
		* visual language: DisclosureRow header, semantic tokens, and MarkdownText body.
		*/
		const AdvisorCard = (0, react.memo)(function AdvisorCard({ node, t }) {
			const data = node.data;
			const verdictKey = `verdict.${data.verdict}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AdvisorCard_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
						rowClassName: AdvisorCard_module_css_default.header,
						leadingClassName: AdvisorCard_module_css_default.leading,
						titleClassName: titleClass(data.verdict),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: dotClass(data.verdict),
							"aria-hidden": true
						}),
						title: t(verdictKey),
						open: false,
						expandable: false,
						onToggle: () => {},
						collapsedContent: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdvisorCard_module_css_default.separator,
							"aria-hidden": true
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: AdvisorCard_module_css_default.turn,
							children: ["# ", data.turn]
						})] })
					}),
					data.issues.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: AdvisorCard_module_css_default.issues,
						"aria-label": t("advisor.issues"),
						children: data.issues.map((issue, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							className: AdvisorCard_module_css_default.issue,
							children: issue
						}, index))
					}),
					data.advice.trim().length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdvisorCard_module_css_default.advice,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: AdvisorCard_module_css_default.adviceLabel,
							children: [t("advisor.advice"), ":"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: data.advice })]
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