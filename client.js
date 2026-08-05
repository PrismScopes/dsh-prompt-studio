window.__ModuleLoader__.load({
	id: "moeblack/prompt-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_web_react = require("@deepseek-ai/dsh-client-web-react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared.ts
		/** Settings namespace shared by the Host registration and browser editor. */
		const PROMPT_STUDIO_NAMESPACE = "prompt-studio";
		/** Namespace reserved for ordered replacement markers owned by the Host half. */
		const PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX = "prompt-studio:override-marker:";
		/**
		* Shipped section inventory. The registry remains authoritative at runtime;
		* this browser-safe snapshot gives the editor readable text and source labels
		* without opening a second Host API beside the settings seam.
		*/
		const BUILTIN_SECTIONS = [
			{
				name: "harness:identity",
				order: -100,
				origin: "core/system-prompt (constructor)",
				text: "You are an AI agent powered by the DeepSeek Harness SDK."
			},
			{
				name: "harness:source",
				order: -99,
				origin: "ui/app-boot addHarnessSourceSection",
				text: "The DeepSeek Harness implementation checkout is at <sourceRoot>. The checkout location and current working directory are separate values and may differ; never infer the working directory from this path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself."
			},
			{
				name: "app:web-surface",
				order: -98,
				origin: "apps/cli/src/web.ts webSurfacePrompt",
				text: "You are interacting with the user through the DeepSeek Harness Web GUI at <webUrl>. When the user refers to \"this page\", \"this GUI\", or \"this app\" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. Starting another server does not update this GUI. Do not start a replacement server unless the user asks; if one is needed, use a managed background task and verify its exact URL."
			},
			{
				name: "deployment:persona",
				order: 0,
				origin: "web.cordis.yml persona",
				text: "You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}."
			},
			{
				name: "plan:policy",
				order: 50,
				origin: "plan/plan-mode (dynamic, plan mode only)",
				text: "<plan fold policy, non-empty only when plan mode folds>"
			},
			{
				name: "tool:read",
				order: 100,
				origin: "fs/tool-fs/src/read.ts",
				text: "Use the read tool — not shell commands like cat — to inspect text files. Results include line numbers. Use offset and limit to continue reading large files."
			},
			{
				name: "tool:write",
				order: 101,
				origin: "fs/tool-fs/src/write.ts",
				text: "Use the write tool to create files or completely replace file contents. Existing files are overwritten, so read an existing file first (the default fs-policy requires it) and prefer edit for targeted changes."
			},
			{
				name: "tool:edit",
				order: 102,
				origin: "fs/tool-fs/src/edit.ts",
				text: "Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string; by default old_string must appear exactly once. If old_string appears multiple times, provide a more specific old_string or set replace_all to true. Read the file first (the default fs-policy requires it), unless you just created or edited it in this session."
			},
			{
				name: "tool:glob",
				order: 103,
				origin: "fs/tool-fs-search/src/glob.ts",
				text: "Use the glob tool — not shell find — to discover files by path pattern. A pattern with no \"/\" matches basenames at any depth, so \"*\" matches every file in the tree rather than its top level. Results are files only, never directories, and include hidden and ignored files."
			},
			{
				name: "tool:grep",
				order: 104,
				origin: "fs/tool-fs-search/src/grep.ts",
				text: "Use the grep tool — not shell grep or rg — to search file contents. Use read on a matched file when you need surrounding context."
			},
			{
				name: "tool:bash",
				order: 105,
				origin: "bash/tool-bash/src/index.ts",
				text: "Check the [exit code: N] marker on every bash result; investigate failures before moving on."
			},
			{
				name: "tool:pwsh",
				order: 105,
				origin: "bash/tool-pwsh/src/index.ts",
				text: "Non-zero exits are reported as [exit code: N] markers; investigate failures before moving on."
			},
			{
				name: "tool:pty",
				order: 106,
				origin: "pty/tool-pty/src/index.ts",
				text: "Use a terminal session only when work needs persistent terminal state or interactive stdin; prefer bash/read/write/edit for bounded one-shot operations. Track every terminal session id and close sessions that no longer matter."
			},
			{
				name: "tool:tasks",
				order: 106,
				origin: "tasks/tool-tasks/src/index.ts",
				text: "Track every background task id you start. You are notified in-session when a task finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running task's work. Before giving a final answer, collect every still-relevant task with task_output (set wait: true only when you are genuinely blocked on it), and task_kill tasks that stopped mattering."
			},
			{
				name: "tool:web_search",
				order: 110,
				origin: "web/tool-web/src/search.ts",
				text: "Use the web_search tool to discover current information on the web. It returns an optional answer plus a list of source URLs."
			},
			{
				name: "tool:web_fetch",
				order: 111,
				origin: "web/tool-web/src/fetch.ts",
				text: "Use the web_fetch tool to retrieve the content of a specific HTTP(S) URL (for example a result from web_search). It returns the page content decoded to text. Cite the URL as a markdown link when you use its content."
			},
			{
				name: "tool:lsp",
				order: 112,
				origin: "lsp/tool-lsp/src/index.ts",
				text: "Use search/read for ordinary navigation. Use lsp when textual matches are ambiguous or before a change requires precise definitions, implementations, or references."
			},
			{
				name: "tool:session-query",
				order: 113,
				origin: "session-query/tool-session-query/src/index.ts",
				text: "Use session_search to find relevant work from prior sessions, or session_event_search to search earlier events in one session."
			},
			{
				name: "tool:goal",
				order: 114,
				origin: "goal/tool-goal/src/index.ts",
				text: "Use goal tools for one long-running completion objective in the current session."
			},
			{
				name: "tool:workflow",
				order: 115,
				origin: "workflow/tool-workflow/src/index.ts",
				text: "Use the workflow tool ONLY when the user explicitly asks for a workflow or for large multi-agent orchestration."
			},
			{
				name: "tool:ralph",
				order: 116,
				origin: "workflow/tool-ralph/src/index.ts",
				text: "Use the ralph tool ONLY when the direct human explicitly asks for a Ralph loop or fresh-agent iterative execution."
			}
		];
		const BUILTIN_NAMES = new Set(BUILTIN_SECTIONS.map((section) => section.name));
		/**
		* Validate the constraints the system-prompt registry cannot express in the settings object schema.
		* @param sections - deployment-authored rows to validate.
		*/
		function validateStudioSections(sections) {
			const names = /* @__PURE__ */ new Set();
			for (const section of sections) {
				if (section.name.length === 0 || section.name.trim() !== section.name) throw new TypeError("prompt section names must be non-empty and have no surrounding whitespace");
				if (!Number.isFinite(section.order)) throw new TypeError(`prompt section "${section.name}" order must be a finite number`);
				if (BUILTIN_NAMES.has(section.name)) throw new TypeError(`prompt section "${section.name}" is built in and cannot be replaced by Prompt Studio`);
				if (section.name.startsWith("prompt-studio:override-marker:")) throw new TypeError(`prompt section names beginning with "${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}" are reserved by Prompt Studio`);
				if (names.has(section.name)) throw new TypeError(`prompt section "${section.name}" is listed more than once`);
				names.add(section.name);
			}
		}
		/**
		* Validate that persisted built-in replacements name one shipped row each.
		* @param overrides - complete built-in replacement rows to validate.
		*/
		function validateBuiltinOverrides(overrides) {
			const names = /* @__PURE__ */ new Set();
			for (const override of overrides) {
				if (!BUILTIN_NAMES.has(override.name)) throw new TypeError(`prompt section "${override.name}" is not a built-in prompt section`);
				if (!Number.isFinite(override.order)) throw new TypeError(`prompt section "${override.name}" order must be a finite number`);
				if (names.has(override.name)) throw new TypeError(`prompt section "${override.name}" is listed more than once`);
				names.add(override.name);
			}
		}
		/**
		* Resolve every shipped row to its default or persisted editor state.
		* @param overrides - persisted replacements indexed by built-in name.
		* @returns the complete shipped inventory in editor state.
		*/
		function resolveBuiltinSections(overrides) {
			validateBuiltinOverrides(overrides);
			const byName = new Map(overrides.map((override) => [override.name, override]));
			return BUILTIN_SECTIONS.map((section) => {
				const override = byName.get(section.name);
				if (override === void 0) return {
					...section,
					enabled: true,
					overridden: false
				};
				return {
					...section,
					...override,
					origin: section.origin,
					overridden: true
				};
			});
		}
		/**
		* Resolve enabled built-ins and deployment sections in registry order.
		* @param sections - deployment-authored prompt rows.
		* @param overrides - persisted built-in replacements.
		* @returns enabled preview rows sorted by numeric order.
		*/
		function buildPreviewSections(sections, overrides = []) {
			return [...resolveBuiltinSections(overrides).filter((section) => section.enabled).map((section) => ({
				name: section.name,
				order: section.order,
				text: section.text,
				origin: "builtin"
			})), ...sections.filter((section) => section.enabled).map((section) => ({
				name: section.name,
				order: section.order,
				text: section.text,
				origin: "user"
			}))].sort((left, right) => left.order - right.order);
		}
		/**
		* Produce the exact blank-line concatenation used by renderPrompt before variable interpolation.
		* @param sections - deployment-authored prompt rows.
		* @param overrides - persisted built-in replacements.
		* @returns complete unresolved prompt preview.
		*/
		function renderPreview(sections, overrides = []) {
			return buildPreviewSections(sections, overrides).map((section) => section.text).filter((text) => text.length > 0).join("\n\n");
		}
		/**
		* Allocate the first readable user-section name absent from the draft.
		* @param sections - existing deployment-authored prompt rows.
		* @returns the first available `user:section` name.
		*/
		function nextSectionName(sections) {
			const names = new Set(sections.map((section) => section.name));
			const base = "user:section";
			if (!names.has(base)) return base;
			for (let suffix = 2;; suffix += 1) {
				const candidate = `${base}-${String(suffix)}`;
				if (!names.has(candidate)) return candidate;
			}
		}
		//#endregion
		//#region src/client/store.ts
		function messageOf$1(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function decodeRows(value, label) {
			if (!Array.isArray(value)) throw new TypeError(`prompt-studio settings has no ${label} array`);
			return value.map((entry, index) => {
				if (typeof entry !== "object" || entry === null) throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} is not an object`);
				const candidate = entry;
				if (typeof candidate.name !== "string" || typeof candidate.order !== "number" || typeof candidate.enabled !== "boolean" || typeof candidate.text !== "string") throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} has an invalid shape`);
				return {
					name: candidate.name,
					order: candidate.order,
					enabled: candidate.enabled,
					text: candidate.text
				};
			});
		}
		function decodeConfig(value) {
			if (typeof value !== "object" || value === null) throw new TypeError("prompt-studio settings value is not an object");
			const candidate = value;
			const sections = decodeRows(candidate.sections, "sections");
			const overrides = candidate.overrides === void 0 ? [] : decodeRows(candidate.overrides, "overrides");
			validateStudioSections(sections);
			validateBuiltinOverrides(overrides);
			return {
				sections,
				overrides
			};
		}
		function namespaceFrom(response) {
			return decodeConfig(response.value);
		}
		/** One browser-side controller, shared by every session-scoped mount of the view. */
		var PromptStudioStore = class {
			api;
			/** Observable remote namespace state consumed by every mounted Prompt Studio view. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				status: "idle",
				error: null,
				writable: false,
				revision: 0,
				sections: [],
				overrides: []
			});
			generation = 0;
			constructor(api) {
				this.api = api;
			}
			/** Refetch the namespace descriptor; newest request wins. */
			async load() {
				const generation = ++this.generation;
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				try {
					const response = await this.api.settings.describe({});
					if (!response.result.ok) throw new Error(response.result.error.message);
					const namespace = response.result.value.namespaces.find((row) => row.ns === PROMPT_STUDIO_NAMESPACE);
					if (namespace === void 0) throw new Error("prompt-studio settings namespace is not registered");
					const config = namespaceFrom(namespace);
					if (generation !== this.generation) return;
					this.accept(namespace, response.result.value.writable, config);
				} catch (error) {
					if (generation !== this.generation) return;
					this.store.update((state) => {
						state.status = "error";
						state.error = messageOf$1(error);
					});
				}
			}
			/**
			* Persist user rows and built-in replacements atomically with stale-editor protection.
			* @param config - complete Prompt Studio draft to commit.
			* @param expectedRevision - namespace revision the draft was based on.
			*/
			async save(config, expectedRevision) {
				validateStudioSections(config.sections);
				validateBuiltinOverrides(config.overrides);
				const generation = ++this.generation;
				const response = await this.api.settings.mutate({
					ns: PROMPT_STUDIO_NAMESPACE,
					ops: [{
						op: "set",
						path: ["sections"],
						value: config.sections.map((section) => ({ ...section }))
					}, {
						op: "set",
						path: ["overrides"],
						value: config.overrides.map((override) => ({ ...override }))
					}],
					expectedRevision
				});
				if (!response.result.ok) throw new Error(response.result.error.message);
				if (generation !== this.generation) return;
				this.accept(response.result.value, this.store.getSnapshot().writable, namespaceFrom(response.result.value));
			}
			accept(namespace, writable, config) {
				this.store.update((state) => {
					state.status = "ready";
					state.error = null;
					state.writable = writable;
					state.revision = namespace.revision;
					state.sections = config.sections;
					state.overrides = config.overrides;
				});
			}
		};
		/**
		* Refresh only after the user has opened the view once.
		* @param controller - shared Prompt Studio browser controller.
		*/
		function refreshIfLoaded(controller) {
			if (controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		//#endregion
		//#region \0dsh-css:/root/prompt-studio-plugin/src/client/PromptStudioView.module.css.mjs
		const css = ".Ewsqaa_root{box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);padding:24px;overflow:auto}.Ewsqaa_pageHeader{justify-content:space-between;align-items:flex-start;gap:20px;max-width:1480px;margin:0 auto 16px;display:flex}.Ewsqaa_title,.Ewsqaa_subtitle,.Ewsqaa_intro,.Ewsqaa_caption,.Ewsqaa_notice,.Ewsqaa_error,.Ewsqaa_empty,.Ewsqaa_excerpt,.Ewsqaa_emptyText,.Ewsqaa_origin,.Ewsqaa_builtinText{margin:0}.Ewsqaa_title{font-size:22px;font-weight:600;line-height:30px}.Ewsqaa_intro{max-width:760px;color:var(--dsw-alias-label-tertiary);margin-top:4px;font-size:14px;line-height:22px}.Ewsqaa_headerActions{flex:none;gap:8px;display:flex}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton,.Ewsqaa_textButton,.Ewsqaa_dangerButton{box-sizing:border-box;font:inherit;cursor:pointer;border:0}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton{border-radius:18px;justify-content:center;align-items:center;height:36px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.Ewsqaa_primaryButton{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill)}.Ewsqaa_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.Ewsqaa_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.Ewsqaa_secondaryButton:hover:not(:disabled),.Ewsqaa_textButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Ewsqaa_primaryButton:disabled,.Ewsqaa_secondaryButton:disabled,.Ewsqaa_textButton:disabled,.Ewsqaa_dangerButton:disabled{cursor:default;opacity:.4}.Ewsqaa_primaryButton:focus-visible,.Ewsqaa_secondaryButton:focus-visible,.Ewsqaa_textButton:focus-visible,.Ewsqaa_dangerButton:focus-visible,.Ewsqaa_input:focus-visible,.Ewsqaa_orderInput:focus-visible,.Ewsqaa_textarea:focus-visible,.Ewsqaa_builtinsSummary:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3);outline:none}.Ewsqaa_notice,.Ewsqaa_error{max-width:1480px;margin:0 auto 10px;font-size:12px;line-height:18px}.Ewsqaa_notice{color:var(--dsw-alias-state-warn-label)}.Ewsqaa_error{color:var(--dsw-alias-state-error-primary)}.Ewsqaa_status{box-sizing:border-box;width:100%;height:100%;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);flex-direction:column;align-items:flex-start;gap:12px;padding:24px;display:flex}.Ewsqaa_status .Ewsqaa_error{margin:0}.Ewsqaa_columns{grid-template-columns:minmax(440px,1fr) minmax(400px,1fr);align-items:start;gap:18px;max-width:1480px;margin:0 auto;display:grid}.Ewsqaa_editorColumn,.Ewsqaa_previewColumn{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;min-width:0;padding:16px}.Ewsqaa_previewColumn{position:sticky;top:0}.Ewsqaa_sectionHeading{justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;display:flex}.Ewsqaa_subtitle{font-size:16px;font-weight:500;line-height:24px}.Ewsqaa_caption,.Ewsqaa_origin,.Ewsqaa_emptyText{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.Ewsqaa_count,.Ewsqaa_orderBadge,.Ewsqaa_stateBadge{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:18px}.Ewsqaa_empty{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:18px;font-size:14px;line-height:22px}.Ewsqaa_userList,.Ewsqaa_builtinList{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.Ewsqaa_userCard,.Ewsqaa_builtinCard{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}.Ewsqaa_rowHeader{align-items:center;gap:8px;min-width:0;display:flex}.Ewsqaa_enabledControl{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex}.Ewsqaa_enabledControl input{accent-color:var(--dsw-alias-brand-primary)}.Ewsqaa_sectionName{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.Ewsqaa_orderBadge{margin-left:auto}.Ewsqaa_textButton,.Ewsqaa_dangerButton{height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border-radius:14px;flex:none;padding:0 9px;font-size:12px;line-height:18px}.Ewsqaa_dangerButton{color:var(--dsw-alias-state-error-primary)}.Ewsqaa_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.Ewsqaa_sectionEditor{background:var(--dsw-alias-bg-module-platform);border-radius:10px;grid-template-columns:minmax(0,1fr) 120px;gap:10px;margin-top:12px;padding:12px;display:grid}.Ewsqaa_field{flex-direction:column;gap:5px;display:flex}.Ewsqaa_textField,.Ewsqaa_builtinTextField{grid-column:1/-1}.Ewsqaa_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.Ewsqaa_input,.Ewsqaa_orderInput,.Ewsqaa_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit;border-radius:8px;font-size:13px}.Ewsqaa_input,.Ewsqaa_orderInput{height:32px;padding:0 9px}.Ewsqaa_textarea{resize:vertical;min-height:150px;padding:9px;line-height:20px}.Ewsqaa_input:disabled,.Ewsqaa_orderInput:disabled,.Ewsqaa_textarea:disabled{cursor:default;opacity:.6}.Ewsqaa_excerpt,.Ewsqaa_builtinText{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin-top:9px;font-size:12px;line-height:18px}.Ewsqaa_excerpt{-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.Ewsqaa_emptyText{margin-top:9px}.Ewsqaa_builtins{border-top:1px solid var(--dsw-alias-border-l2);margin-top:14px;padding-top:14px}.Ewsqaa_builtinsSummary{width:fit-content;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;align-items:center;gap:8px;font-size:14px;font-weight:500;line-height:22px;display:flex}.Ewsqaa_builtinsSummary .Ewsqaa_count{margin-left:4px}.Ewsqaa_builtinList{margin-top:10px}.Ewsqaa_builtinCard{background:var(--dsw-alias-bg-module-platform)}.Ewsqaa_origin{margin-top:5px}.Ewsqaa_assemblyOrder{background:var(--dsw-alias-bg-module-platform);border-radius:10px;flex-direction:column;gap:2px;max-height:190px;margin-bottom:12px;padding:8px;display:flex;overflow:auto}.Ewsqaa_assemblyOrder,.Ewsqaa_preview{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}.Ewsqaa_assemblyRow{min-height:24px;color:var(--dsw-alias-label-secondary);grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:7px;font-size:12px;line-height:18px;display:grid}.Ewsqaa_assemblyIndex,.Ewsqaa_assemblyOrderValue{color:var(--dsw-alias-label-tertiary)}.Ewsqaa_preview{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;min-height:320px;max-height:calc(100vh - 380px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;margin:0;padding:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:19px;overflow:auto}@media (width<=1000px){.Ewsqaa_columns{grid-template-columns:1fr}.Ewsqaa_previewColumn{position:static}.Ewsqaa_preview{max-height:520px}}@media (width<=680px){.Ewsqaa_root{padding:16px}.Ewsqaa_pageHeader{flex-direction:column}.Ewsqaa_headerActions{width:100%}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton{flex:1}.Ewsqaa_rowHeader{flex-wrap:wrap}.Ewsqaa_sectionName{flex-basis:100%;order:-1}.Ewsqaa_orderBadge{margin-left:0}.Ewsqaa_sectionEditor{grid-template-columns:1fr}.Ewsqaa_textField,.Ewsqaa_builtinTextField{grid-column:auto}}";
		const tagId = "moeblack/prompt-studio/PromptStudioView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "moeblack/prompt-studio";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PromptStudioView_module_css_default = {
			"textButton": "Ewsqaa_textButton",
			"excerpt": "Ewsqaa_excerpt",
			"assemblyOrderValue": "Ewsqaa_assemblyOrderValue",
			"emptyText": "Ewsqaa_emptyText",
			"field": "Ewsqaa_field",
			"builtinText": "Ewsqaa_builtinText",
			"primaryButton": "Ewsqaa_primaryButton",
			"sectionEditor": "Ewsqaa_sectionEditor",
			"sectionHeading": "Ewsqaa_sectionHeading",
			"builtinTextField": "Ewsqaa_builtinTextField",
			"builtinCard": "Ewsqaa_builtinCard",
			"error": "Ewsqaa_error",
			"builtinList": "Ewsqaa_builtinList",
			"builtinsSummary": "Ewsqaa_builtinsSummary",
			"columns": "Ewsqaa_columns",
			"empty": "Ewsqaa_empty",
			"editorColumn": "Ewsqaa_editorColumn",
			"orderBadge": "Ewsqaa_orderBadge",
			"fieldLabel": "Ewsqaa_fieldLabel",
			"sectionName": "Ewsqaa_sectionName",
			"assemblyRow": "Ewsqaa_assemblyRow",
			"assemblyOrder": "Ewsqaa_assemblyOrder",
			"textarea": "Ewsqaa_textarea",
			"previewColumn": "Ewsqaa_previewColumn",
			"root": "Ewsqaa_root",
			"preview": "Ewsqaa_preview",
			"stateBadge": "Ewsqaa_stateBadge",
			"textField": "Ewsqaa_textField",
			"pageHeader": "Ewsqaa_pageHeader",
			"enabledControl": "Ewsqaa_enabledControl",
			"origin": "Ewsqaa_origin",
			"headerActions": "Ewsqaa_headerActions",
			"dangerButton": "Ewsqaa_dangerButton",
			"notice": "Ewsqaa_notice",
			"rowHeader": "Ewsqaa_rowHeader",
			"builtins": "Ewsqaa_builtins",
			"caption": "Ewsqaa_caption",
			"userCard": "Ewsqaa_userCard",
			"intro": "Ewsqaa_intro",
			"title": "Ewsqaa_title",
			"secondaryButton": "Ewsqaa_secondaryButton",
			"userList": "Ewsqaa_userList",
			"assemblyIndex": "Ewsqaa_assemblyIndex",
			"count": "Ewsqaa_count",
			"orderInput": "Ewsqaa_orderInput",
			"input": "Ewsqaa_input",
			"subtitle": "Ewsqaa_subtitle",
			"status": "Ewsqaa_status"
		};
		//#endregion
		//#region src/client/PromptStudioView.tsx
		/** Interactive prompt-section editor and exact template concatenation preview. */
		function copyConfig(state) {
			return {
				sections: state.sections.map((section) => ({ ...section })),
				overrides: state.overrides.map((override) => ({ ...override }))
			};
		}
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function defaultBuiltin(name) {
			const section = BUILTIN_SECTIONS.find((candidate) => candidate.name === name);
			if (section === void 0) throw new Error(`unknown built-in prompt section "${name}"`);
			return section;
		}
		function isDefaultOverride(override, section) {
			return override.enabled && override.order === section.order && override.text === section.text;
		}
		function replaceBuiltinOverride(overrides, name, patch) {
			const shipped = defaultBuiltin(name);
			const replacement = {
				...overrides.find((override) => override.name === name) ?? {
					name,
					order: shipped.order,
					enabled: true,
					text: shipped.text
				},
				...patch
			};
			if (isDefaultOverride(replacement, shipped)) return overrides.filter((override) => override.name !== name);
			if (overrides.some((override) => override.name === name)) return overrides.map((override) => override.name === name ? replacement : override);
			return [...overrides, replacement];
		}
		/** Conversation-view entry point. */
		function PromptStudioView({ controller, useSnapshot }) {
			const remote = useSnapshot((state) => state);
			(0, react.useEffect)(() => {
				if (remote.status === "idle") controller.load();
			}, [controller, remote.status]);
			if (remote.status === "idle" || remote.status === "loading" && remote.sections.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PromptStudioView_module_css_default["status"],
				children: "Loading Prompt Studio…"
			});
			if (remote.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: PromptStudioView_module_css_default["status"],
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: PromptStudioView_module_css_default["error"],
					children: remote.error
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: PromptStudioView_module_css_default["secondaryButton"],
					onClick: () => {
						controller.load();
					},
					children: "Retry"
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptStudioEditor, {
				controller,
				remote
			});
		}
		function PromptStudioEditor({ controller, remote }) {
			const [draft, setDraft] = (0, react.useState)(() => copyConfig(remote));
			const [dirty, setDirty] = (0, react.useState)(false);
			const [editingIndex, setEditingIndex] = (0, react.useState)(null);
			const [editingBuiltin, setEditingBuiltin] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setDraft(copyConfig(remote));
				setDirty(false);
				setSaving(false);
				setSaveError(null);
				setEditingIndex((index) => index !== null && index < remote.sections.length ? index : null);
				setEditingBuiltin(null);
			}, [
				remote.overrides,
				remote.revision,
				remote.sections
			]);
			const builtins = (0, react.useMemo)(() => resolveBuiltinSections(draft.overrides), [draft.overrides]);
			const previewRows = (0, react.useMemo)(() => buildPreviewSections(draft.sections, draft.overrides), [draft.overrides, draft.sections]);
			const preview = (0, react.useMemo)(() => renderPreview(draft.sections, draft.overrides), [draft.overrides, draft.sections]);
			const changeSection = (index, patch) => {
				setDraft((current) => ({
					...current,
					sections: current.sections.map((section, position) => position === index ? {
						...section,
						...patch
					} : section)
				}));
				setDirty(true);
				setSaveError(null);
			};
			const addSection = () => {
				setDraft((current) => {
					const sections = [...current.sections, {
						name: nextSectionName(current.sections),
						order: 200,
						enabled: true,
						text: ""
					}];
					setEditingIndex(sections.length - 1);
					return {
						...current,
						sections
					};
				});
				setDirty(true);
				setSaveError(null);
			};
			const removeSection = (index) => {
				setDraft((current) => ({
					...current,
					sections: current.sections.filter((_section, position) => position !== index)
				}));
				setEditingIndex((current) => {
					if (current === null) return null;
					if (current === index) return null;
					return current > index ? current - 1 : current;
				});
				setDirty(true);
				setSaveError(null);
			};
			const changeBuiltin = (name, patch) => {
				setDraft((current) => ({
					...current,
					overrides: replaceBuiltinOverride(current.overrides, name, patch)
				}));
				setDirty(true);
				setSaveError(null);
			};
			const restoreBuiltin = (name) => {
				setDraft((current) => ({
					...current,
					overrides: current.overrides.filter((override) => override.name !== name)
				}));
				setDirty(true);
				setSaveError(null);
			};
			const save = () => {
				if (!dirty || saving || !remote.writable) return;
				setSaving(true);
				setSaveError(null);
				controller.save(draft, remote.revision).catch((error) => {
					setSaveError(messageOf(error));
				}).finally(() => {
					setSaving(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: PromptStudioView_module_css_default["root"],
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PromptStudioView_module_css_default["pageHeader"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: PromptStudioView_module_css_default["title"],
							children: "Prompt Studio"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: PromptStudioView_module_css_default["intro"],
							children: "Edit shipped and deployment sections, choose their assembly order, and inspect the complete prompt template before variables are resolved."
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PromptStudioView_module_css_default["headerActions"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: PromptStudioView_module_css_default["secondaryButton"],
								disabled: !remote.writable,
								onClick: addSection,
								children: "Add section"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: PromptStudioView_module_css_default["primaryButton"],
								disabled: !dirty || saving || !remote.writable,
								onClick: save,
								children: saving ? "Saving…" : "Save changes"
							})]
						})]
					}),
					!remote.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["notice"],
						children: "The active settings provider is read-only."
					}) : null,
					remote.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["notice"],
						children: "Refreshing settings…"
					}) : null,
					saveError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["error"],
						children: saveError
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PromptStudioView_module_css_default["columns"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: PromptStudioView_module_css_default["editorColumn"],
							"aria-label": "Prompt sections",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PromptStudioView_module_css_default["sectionHeading"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: PromptStudioView_module_css_default["subtitle"],
										children: "User sections"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: PromptStudioView_module_css_default["caption"],
										children: "Enabled rows are registered immediately after a successful save."
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PromptStudioView_module_css_default["count"],
										children: String(draft.sections.length)
									})]
								}),
								draft.sections.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: PromptStudioView_module_css_default["empty"],
									children: "No user sections."
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
									className: PromptStudioView_module_css_default["userList"],
									children: draft.sections.map((section, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: PromptStudioView_module_css_default["userCard"],
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: PromptStudioView_module_css_default["rowHeader"],
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: PromptStudioView_module_css_default["enabledControl"],
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: section.enabled,
														disabled: !remote.writable,
														onChange: (event) => {
															changeSection(index, { enabled: event.target.checked });
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: section.enabled ? "Enabled" : "Disabled" })]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: PromptStudioView_module_css_default["sectionName"],
													children: section.name || "(unnamed section)"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: PromptStudioView_module_css_default["orderBadge"],
													children: ["Order ", String(section.order)]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: PromptStudioView_module_css_default["textButton"],
													onClick: () => {
														setEditingIndex(editingIndex === index ? null : index);
													},
													children: editingIndex === index ? "Close" : "Edit"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: PromptStudioView_module_css_default["dangerButton"],
													disabled: !remote.writable,
													onClick: () => {
														removeSection(index);
													},
													children: "Remove"
												})
											]
										}), editingIndex === index ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: PromptStudioView_module_css_default["sectionEditor"],
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: PromptStudioView_module_css_default["field"],
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["fieldLabel"],
														children: "Name"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														className: PromptStudioView_module_css_default["input"],
														value: section.name,
														disabled: !remote.writable,
														onChange: (event) => {
															changeSection(index, { name: event.target.value });
														}
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: PromptStudioView_module_css_default["field"],
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["fieldLabel"],
														children: "Order"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														className: PromptStudioView_module_css_default["orderInput"],
														type: "number",
														value: section.order,
														disabled: !remote.writable,
														onChange: (event) => {
															changeSection(index, { order: Number(event.target.value) });
														}
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: `${PromptStudioView_module_css_default["field"]} ${PromptStudioView_module_css_default["textField"]}`,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["fieldLabel"],
														children: "Section text"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
														className: PromptStudioView_module_css_default["textarea"],
														value: section.text,
														disabled: !remote.writable,
														rows: 8,
														onChange: (event) => {
															changeSection(index, { text: event.target.value });
														}
													})]
												})
											]
										}) : section.text.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: PromptStudioView_module_css_default["excerpt"],
											children: section.text
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: PromptStudioView_module_css_default["emptyText"],
											children: "Empty text contributes nothing to the rendered prompt."
										})]
									}, `${String(index)}:${section.name}`))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: PromptStudioView_module_css_default["builtins"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
										className: PromptStudioView_module_css_default["builtinsSummary"],
										children: ["Built-in sections ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: PromptStudioView_module_css_default["count"],
											children: String(BUILTIN_SECTIONS.length)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
										className: PromptStudioView_module_css_default["builtinList"],
										children: builtins.map((section) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
											className: PromptStudioView_module_css_default["builtinCard"],
											"aria-label": `Built-in section ${section.name}`,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: PromptStudioView_module_css_default["rowHeader"],
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: PromptStudioView_module_css_default["enabledControl"],
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: section.enabled,
																disabled: !remote.writable,
																onChange: (event) => {
																	changeBuiltin(section.name, { enabled: event.target.checked });
																}
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: section.enabled ? "On" : "Off" })]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["sectionName"],
															children: section.name
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["stateBadge"],
															children: section.enabled ? section.overridden ? "Overridden" : "Default" : "Closed"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: PromptStudioView_module_css_default["orderBadge"],
															children: ["Order ", String(section.order)]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: PromptStudioView_module_css_default["textButton"],
															onClick: () => {
																setEditingBuiltin(editingBuiltin === section.name ? null : section.name);
															},
															children: editingBuiltin === section.name ? "Close" : "Edit"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: PromptStudioView_module_css_default["textButton"],
															disabled: !remote.writable || !section.overridden,
															onClick: () => {
																restoreBuiltin(section.name);
															},
															children: "Restore default"
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: PromptStudioView_module_css_default["origin"],
													children: section.origin
												}),
												editingBuiltin === section.name ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: PromptStudioView_module_css_default["sectionEditor"],
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "Order"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															className: PromptStudioView_module_css_default["orderInput"],
															type: "number",
															value: section.order,
															disabled: !remote.writable,
															onChange: (event) => {
																changeBuiltin(section.name, { order: Number(event.target.value) });
															}
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: `${PromptStudioView_module_css_default["field"]} ${PromptStudioView_module_css_default["builtinTextField"]}`,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "Section text"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
															className: PromptStudioView_module_css_default["textarea"],
															value: section.text,
															disabled: !remote.writable,
															rows: 8,
															onChange: (event) => {
																changeBuiltin(section.name, { text: event.target.value });
															}
														})]
													})]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: PromptStudioView_module_css_default["builtinText"],
													children: section.text
												})
											]
										}, section.name))
									})]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: PromptStudioView_module_css_default["previewColumn"],
							"aria-label": "Complete prompt preview",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PromptStudioView_module_css_default["sectionHeading"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: PromptStudioView_module_css_default["subtitle"],
										children: "Complete preview"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: PromptStudioView_module_css_default["caption"],
										children: [
											"Raw template; variables such as ",
											"{{model}}",
											" and ",
											"{{cwd}}",
											" resolve per request."
										]
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PromptStudioView_module_css_default["count"],
										children: [String(previewRows.length), " sections"]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: PromptStudioView_module_css_default["assemblyOrder"],
									children: previewRows.map((section, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PromptStudioView_module_css_default["assemblyRow"],
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PromptStudioView_module_css_default["assemblyIndex"],
												children: String(index + 1)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: section.name }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PromptStudioView_module_css_default["assemblyOrderValue"],
												children: String(section.order)
											})
										]
									}, `${section.origin}:${section.name}`))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
									className: PromptStudioView_module_css_default["preview"],
									children: preview
								})
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Slot registry, declaration-order edge, and settings transport. */
		const inject = [
			"slots",
			"conversation",
			"connection"
		];
		/** Register the tab, its shared controller, and pushed invalidations. */
		function apply(ctx) {
			const controller = new PromptStudioStore(ctx.get("connection").api);
			const useSnapshot = (0, _deepseek_ai_dsh_client_web_react.bindSnapshotSelector)(controller.store);
			ctx.effect(() => {
				const refresh = () => {
					refreshIfLoaded(controller);
				};
				const disposers = [ctx.on("settings/changed", (namespace) => {
					if (namespace === "prompt-studio") refresh();
				}), ctx.on("connection/reset", refresh)];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-prompt-studio: pushed invalidations");
			ctx.slots.register({
				name: "conversation.view",
				id: "prompt-studio",
				order: 20,
				label: "Prompt Studio",
				inject: () => ({
					controller,
					useSnapshot
				})
			}, PromptStudioView);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map