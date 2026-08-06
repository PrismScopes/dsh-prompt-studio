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
		/** Same-origin endpoint exposing the runtime-discovered prompt inventory. */
		const PROMPT_STUDIO_STATE_PATH = "/prompt-studio/state";
		/** Namespace reserved for ordered replacement markers owned by the Host half. */
		const PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX = "prompt-studio:override-marker:";
		const KINDS$1 = new Set(["native", "supplement"]);
		const POSITIONS$1 = new Set([
			"after_system",
			"anchored",
			"tail"
		]);
		const ROLES$1 = new Set([
			"system",
			"user",
			"assistant"
		]);
		function validateIdentifier(value, label) {
			if (value.length === 0 || value.trim() !== value) throw new TypeError(`${label} must be non-empty and have no surrounding whitespace`);
		}
		/** Return whether a supplement targets one runtime-native component. */
		function isNativeOverride(component) {
			return component.kind === "supplement" && component.origin !== void 0;
		}
		/**
		* Validate configured or runtime component rows.
		* @param components - rows to validate.
		* @param allowNative - whether runtime-only native rows are accepted.
		*/
		function validatePromptComponents(components, allowNative = false) {
			const ids = /* @__PURE__ */ new Set();
			const overrideTargets = /* @__PURE__ */ new Set();
			for (const component of components) {
				validateIdentifier(component.id, "prompt component ids");
				if (!KINDS$1.has(component.kind)) throw new TypeError(`prompt component "${component.id}" has an invalid kind`);
				if (!POSITIONS$1.has(component.position)) throw new TypeError(`prompt component "${component.id}" has an invalid position`);
				if (!ROLES$1.has(component.role)) throw new TypeError(`prompt component "${component.id}" has an invalid role`);
				if (!Number.isFinite(component.order)) throw new TypeError(`prompt component "${component.id}" order must be a finite number`);
				if (component.id.startsWith("prompt-studio:override-marker:")) throw new TypeError(`prompt component ids beginning with "${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}" are reserved`);
				if (ids.has(component.id)) throw new TypeError(`prompt component "${component.id}" is listed more than once`);
				ids.add(component.id);
				if (component.kind === "native") {
					if (!allowNative) throw new TypeError(`native prompt component "${component.id}" cannot be persisted`);
					if (component.origin !== void 0) throw new TypeError(`native prompt component "${component.id}" cannot override another component`);
					if (component.position !== "after_system" || component.role !== "system") throw new TypeError(`native prompt component "${component.id}" must use the system role and system position`);
					continue;
				}
				if (component.origin === void 0) continue;
				validateIdentifier(component.origin, `supplement "${component.id}" native target`);
				if (overrideTargets.has(component.origin)) throw new TypeError(`native prompt component "${component.origin}" is overridden more than once`);
				overrideTargets.add(component.origin);
			}
		}
		function uniqueComponentId(preferred, used) {
			if (!used.has(preferred)) {
				used.add(preferred);
				return preferred;
			}
			for (let suffix = 2;; suffix += 1) {
				const candidate = `${preferred}-${String(suffix)}`;
				if (used.has(candidate)) continue;
				used.add(candidate);
				return candidate;
			}
		}
		/** Resolve native override targets for a draft system-slot preview. */
		function buildDraftSystemComponents(native, configured) {
			validatePromptComponents(native, true);
			validatePromptComponents(configured);
			const overrides = new Map(configured.filter(isNativeOverride).map((component) => [component.origin, component]));
			return native.flatMap((component) => {
				if (overrides.get(component.id) === void 0) return component.enabled ? [{ ...component }] : [];
				return [];
			}).sort((left, right) => left.order - right.order);
		}
		/** Concatenate enabled system components using the Host renderer's blank-line rule. */
		function renderSystemPreview(components) {
			return components.map((component) => component.template).filter((text) => text.length > 0).join("\n\n");
		}
		/** Allocate the first readable supplement id absent from a component draft. */
		function nextSupplementId(components) {
			return uniqueComponentId("supplement:message", new Set(components.map((component) => component.id)));
		}
		/** Allocate a readable id for a supplement overriding one native component. */
		function nextOverrideId(components, target) {
			const used = new Set(components.map((component) => component.id));
			return uniqueComponentId(`override:${target}`, used);
		}
		//#endregion
		//#region src/client/store.ts
		function messageOf$1(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function objectRow(value, label, index) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} is not an object`);
			return value;
		}
		const KINDS = new Set(["native", "supplement"]);
		const POSITIONS = new Set([
			"after_system",
			"anchored",
			"tail"
		]);
		const ROLES = new Set([
			"system",
			"user",
			"assistant"
		]);
		function decodeComponents(value, label, allowNative) {
			if (!Array.isArray(value)) throw new TypeError(`prompt-studio ${label} is not an array`);
			const components = value.map((entry, index) => {
				const candidate = objectRow(entry, label, index);
				const kind = candidate["kind"];
				const position = candidate["position"];
				const role = candidate["role"];
				if (typeof candidate["id"] !== "string" || typeof kind !== "string" || !KINDS.has(kind) || typeof position !== "string" || !POSITIONS.has(position) || typeof role !== "string" || !ROLES.has(role) || typeof candidate["order"] !== "number" || typeof candidate["enabled"] !== "boolean" || typeof candidate["template"] !== "string" || candidate["origin"] !== void 0 && typeof candidate["origin"] !== "string") throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} has an invalid shape`);
				return {
					id: candidate["id"],
					kind,
					position,
					role,
					order: candidate["order"],
					enabled: candidate["enabled"],
					template: candidate["template"],
					...candidate["origin"] === void 0 ? {} : { origin: candidate["origin"] }
				};
			});
			validatePromptComponents(components, allowNative);
			return components;
		}
		function decodeConfig(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("prompt-studio settings value is not an object");
			return { components: decodeComponents(value.components, "components", false) };
		}
		function namespaceFrom(response) {
			return decodeConfig(response.value);
		}
		function decodeCatalog(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("prompt-studio runtime catalog is not an object");
			const candidate = value;
			if (typeof candidate.revision !== "number" || !Number.isSafeInteger(candidate.revision)) throw new TypeError("prompt-studio runtime catalog has an invalid revision");
			return {
				revision: candidate.revision,
				native: decodeComponents(candidate.native, "native catalog", true),
				assembled: decodeComponents(candidate.assembled, "assembled catalog", true)
			};
		}
		async function loadCatalog() {
			const response = await fetch(PROMPT_STUDIO_STATE_PATH, {
				method: "GET",
				headers: { accept: "application/json" },
				cache: "no-store"
			});
			if (!response.ok) throw new Error(`prompt-studio runtime catalog returned HTTP ${String(response.status)}`);
			return decodeCatalog(await response.json());
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
				components: [],
				native: [],
				assembled: [],
				catalogRevision: 0
			});
			generation = 0;
			constructor(api) {
				this.api = api;
			}
			/** Refetch the namespace descriptor and runtime registry; newest request wins. */
			async load() {
				const generation = ++this.generation;
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				try {
					const [response, catalog] = await Promise.all([this.api.settings.describe({}), loadCatalog()]);
					if (!response.result.ok) throw new Error(response.result.error.message);
					const namespace = response.result.value.namespaces.find((row) => row.ns === PROMPT_STUDIO_NAMESPACE);
					if (namespace === void 0) throw new Error("prompt-studio settings namespace is not registered");
					const config = namespaceFrom(namespace);
					if (generation !== this.generation) return;
					this.accept(namespace, response.result.value.writable, config, catalog);
				} catch (error) {
					if (generation !== this.generation) return;
					this.store.update((state) => {
						state.status = "error";
						state.error = messageOf$1(error);
					});
				}
			}
			/** Persist one unified component draft with stale-editor protection. */
			async save(components, expectedRevision) {
				validatePromptComponents(components);
				const generation = ++this.generation;
				const response = await this.api.settings.mutate({
					ns: PROMPT_STUDIO_NAMESPACE,
					ops: [{
						op: "set",
						path: ["components"],
						value: components.map((component) => ({ ...component }))
					}],
					expectedRevision
				});
				if (!response.result.ok) throw new Error(response.result.error.message);
				const catalog = await loadCatalog();
				if (generation !== this.generation) return;
				this.accept(response.result.value, this.store.getSnapshot().writable, namespaceFrom(response.result.value), catalog);
			}
			accept(namespace, writable, config, catalog) {
				this.store.update((state) => {
					state.status = "ready";
					state.error = null;
					state.writable = writable;
					state.revision = namespace.revision;
					state.components = config.components;
					state.native = catalog.native;
					state.assembled = catalog.assembled;
					state.catalogRevision = catalog.revision;
				});
			}
		};
		/** Refresh only after the user has opened the view once. */
		function refreshIfLoaded(controller) {
			if (controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		//#endregion
		//#region \0dsh-css:/root/prompt-studio-plugin/src/client/PromptStudioView.module.css.mjs
		const css = ".Ewsqaa_root{box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);padding:24px;overflow:auto}.Ewsqaa_pageHeader{justify-content:space-between;align-items:flex-start;gap:20px;max-width:1480px;margin:0 auto 16px;display:flex}.Ewsqaa_title,.Ewsqaa_subtitle,.Ewsqaa_intro,.Ewsqaa_caption,.Ewsqaa_notice,.Ewsqaa_error,.Ewsqaa_empty,.Ewsqaa_excerpt,.Ewsqaa_emptyText,.Ewsqaa_origin,.Ewsqaa_builtinText{margin:0}.Ewsqaa_title{font-size:22px;font-weight:600;line-height:30px}.Ewsqaa_intro{max-width:760px;color:var(--dsw-alias-label-tertiary);margin-top:4px;font-size:14px;line-height:22px}.Ewsqaa_headerActions{flex-wrap:wrap;flex:none;justify-content:flex-end;gap:8px;display:flex}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton,.Ewsqaa_textButton,.Ewsqaa_dangerButton{box-sizing:border-box;font:inherit;cursor:pointer;border:0}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton{border-radius:18px;justify-content:center;align-items:center;height:36px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.Ewsqaa_primaryButton{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill)}.Ewsqaa_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.Ewsqaa_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.Ewsqaa_secondaryButton:hover:not(:disabled),.Ewsqaa_textButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Ewsqaa_primaryButton:disabled,.Ewsqaa_secondaryButton:disabled,.Ewsqaa_textButton:disabled,.Ewsqaa_dangerButton:disabled{cursor:default;opacity:.4}.Ewsqaa_primaryButton:focus-visible,.Ewsqaa_secondaryButton:focus-visible,.Ewsqaa_textButton:focus-visible,.Ewsqaa_dangerButton:focus-visible,.Ewsqaa_input:focus-visible,.Ewsqaa_orderInput:focus-visible,.Ewsqaa_select:focus-visible,.Ewsqaa_textarea:focus-visible,.Ewsqaa_builtinsSummary:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3);outline:none}.Ewsqaa_notice,.Ewsqaa_error{max-width:1480px;margin:0 auto 10px;font-size:12px;line-height:18px}.Ewsqaa_notice{color:var(--dsw-alias-state-warn-label)}.Ewsqaa_error{color:var(--dsw-alias-state-error-primary)}.Ewsqaa_status{box-sizing:border-box;width:100%;height:100%;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);flex-direction:column;align-items:flex-start;gap:12px;padding:24px;display:flex}.Ewsqaa_status .Ewsqaa_error{margin:0}.Ewsqaa_columns{grid-template-columns:minmax(440px,1fr) minmax(400px,1fr);align-items:start;gap:18px;max-width:1480px;margin:0 auto;display:grid}.Ewsqaa_editorColumn,.Ewsqaa_previewColumn{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;min-width:0;padding:16px}.Ewsqaa_previewColumn{position:sticky;top:0}.Ewsqaa_sectionHeading{justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;display:flex}.Ewsqaa_subtitle{font-size:16px;font-weight:500;line-height:24px}.Ewsqaa_caption,.Ewsqaa_origin,.Ewsqaa_emptyText{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.Ewsqaa_count,.Ewsqaa_orderBadge,.Ewsqaa_stateBadge,.Ewsqaa_kindBadge,.Ewsqaa_positionBadge,.Ewsqaa_roleBadge{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:18px}.Ewsqaa_empty{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:18px;font-size:14px;line-height:22px}.Ewsqaa_componentList,.Ewsqaa_userList,.Ewsqaa_builtinList{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.Ewsqaa_componentCard,.Ewsqaa_userCard,.Ewsqaa_builtinCard{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}.Ewsqaa_rowHeader{align-items:center;gap:8px;min-width:0;display:flex}.Ewsqaa_enabledControl{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex}.Ewsqaa_enabledControl input{accent-color:var(--dsw-alias-brand-primary)}.Ewsqaa_sectionName{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.Ewsqaa_orderBadge{margin-left:auto}.Ewsqaa_kindBadge,.Ewsqaa_positionBadge,.Ewsqaa_roleBadge,.Ewsqaa_stateBadge{background:var(--dsw-alias-bg-module-platform);border-radius:9px;padding:1px 6px}.Ewsqaa_kindBadge{color:var(--dsw-alias-label-secondary)}.Ewsqaa_textButton,.Ewsqaa_dangerButton{height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border-radius:14px;flex:none;padding:0 9px;font-size:12px;line-height:18px}.Ewsqaa_dangerButton{color:var(--dsw-alias-state-error-primary)}.Ewsqaa_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.Ewsqaa_componentEditor,.Ewsqaa_sectionEditor{background:var(--dsw-alias-bg-module-platform);border-radius:10px;grid-template-columns:minmax(0,1fr) 120px minmax(150px,.6fr);gap:10px;margin-top:12px;padding:12px;display:grid}.Ewsqaa_field{flex-direction:column;gap:5px;display:flex}.Ewsqaa_templateField,.Ewsqaa_textField,.Ewsqaa_builtinTextField{grid-column:1/-1}.Ewsqaa_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.Ewsqaa_input,.Ewsqaa_orderInput,.Ewsqaa_select,.Ewsqaa_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit;border-radius:8px;font-size:13px}.Ewsqaa_input,.Ewsqaa_orderInput,.Ewsqaa_select{height:32px;padding:0 9px}.Ewsqaa_textarea{resize:vertical;min-height:150px;padding:9px;line-height:20px}.Ewsqaa_input:disabled,.Ewsqaa_orderInput:disabled,.Ewsqaa_select:disabled,.Ewsqaa_textarea:disabled{cursor:default;opacity:.6}.Ewsqaa_excerpt,.Ewsqaa_builtinText{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin-top:9px;font-size:12px;line-height:18px}.Ewsqaa_excerpt{-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.Ewsqaa_emptyText{margin-top:9px}.Ewsqaa_builtins{border-top:1px solid var(--dsw-alias-border-l2);margin-top:14px;padding-top:14px}.Ewsqaa_builtinsSummary{width:fit-content;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;align-items:center;gap:8px;font-size:14px;font-weight:500;line-height:22px;display:flex}.Ewsqaa_builtinsSummary .Ewsqaa_count{margin-left:4px}.Ewsqaa_builtinList{margin-top:10px}.Ewsqaa_builtinCard{background:var(--dsw-alias-bg-module-platform)}.Ewsqaa_origin{margin-top:5px}.Ewsqaa_assemblyOrder{background:var(--dsw-alias-bg-module-platform);border-radius:10px;flex-direction:column;gap:2px;max-height:190px;margin-bottom:12px;padding:8px;display:flex;overflow:auto}.Ewsqaa_assemblyOrder,.Ewsqaa_preview{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}.Ewsqaa_assemblyRow{min-height:24px;color:var(--dsw-alias-label-secondary);grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:7px;font-size:12px;line-height:18px;display:grid}.Ewsqaa_assemblyIndex,.Ewsqaa_assemblyOrderValue{color:var(--dsw-alias-label-tertiary)}.Ewsqaa_preview{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;min-height:320px;max-height:calc(100vh - 380px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;margin:0;padding:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:19px;overflow:auto}@media (width<=1000px){.Ewsqaa_columns{grid-template-columns:1fr}.Ewsqaa_previewColumn{position:static}.Ewsqaa_preview{max-height:520px}}@media (width<=680px){.Ewsqaa_root{padding:16px}.Ewsqaa_pageHeader{flex-direction:column}.Ewsqaa_headerActions{width:100%}.Ewsqaa_primaryButton,.Ewsqaa_secondaryButton{flex:1}.Ewsqaa_rowHeader{flex-wrap:wrap}.Ewsqaa_sectionName{flex-basis:100%;order:-1}.Ewsqaa_orderBadge{margin-left:0}.Ewsqaa_componentEditor,.Ewsqaa_sectionEditor{grid-template-columns:1fr}.Ewsqaa_templateField,.Ewsqaa_textField,.Ewsqaa_builtinTextField{grid-column:auto}}";
		const tagId = "moeblack/prompt-studio/PromptStudioView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "moeblack/prompt-studio";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PromptStudioView_module_css_default = {
			"stateBadge": "Ewsqaa_stateBadge",
			"roleBadge": "Ewsqaa_roleBadge",
			"dangerButton": "Ewsqaa_dangerButton",
			"editorColumn": "Ewsqaa_editorColumn",
			"sectionName": "Ewsqaa_sectionName",
			"componentCard": "Ewsqaa_componentCard",
			"count": "Ewsqaa_count",
			"textField": "Ewsqaa_textField",
			"sectionEditor": "Ewsqaa_sectionEditor",
			"builtinsSummary": "Ewsqaa_builtinsSummary",
			"field": "Ewsqaa_field",
			"error": "Ewsqaa_error",
			"title": "Ewsqaa_title",
			"secondaryButton": "Ewsqaa_secondaryButton",
			"componentEditor": "Ewsqaa_componentEditor",
			"assemblyOrder": "Ewsqaa_assemblyOrder",
			"preview": "Ewsqaa_preview",
			"orderBadge": "Ewsqaa_orderBadge",
			"assemblyIndex": "Ewsqaa_assemblyIndex",
			"templateField": "Ewsqaa_templateField",
			"input": "Ewsqaa_input",
			"assemblyRow": "Ewsqaa_assemblyRow",
			"caption": "Ewsqaa_caption",
			"builtinTextField": "Ewsqaa_builtinTextField",
			"pageHeader": "Ewsqaa_pageHeader",
			"assemblyOrderValue": "Ewsqaa_assemblyOrderValue",
			"subtitle": "Ewsqaa_subtitle",
			"previewColumn": "Ewsqaa_previewColumn",
			"textButton": "Ewsqaa_textButton",
			"positionBadge": "Ewsqaa_positionBadge",
			"userCard": "Ewsqaa_userCard",
			"textarea": "Ewsqaa_textarea",
			"empty": "Ewsqaa_empty",
			"emptyText": "Ewsqaa_emptyText",
			"headerActions": "Ewsqaa_headerActions",
			"kindBadge": "Ewsqaa_kindBadge",
			"componentList": "Ewsqaa_componentList",
			"orderInput": "Ewsqaa_orderInput",
			"sectionHeading": "Ewsqaa_sectionHeading",
			"builtinList": "Ewsqaa_builtinList",
			"primaryButton": "Ewsqaa_primaryButton",
			"origin": "Ewsqaa_origin",
			"select": "Ewsqaa_select",
			"columns": "Ewsqaa_columns",
			"notice": "Ewsqaa_notice",
			"excerpt": "Ewsqaa_excerpt",
			"userList": "Ewsqaa_userList",
			"builtinCard": "Ewsqaa_builtinCard",
			"enabledControl": "Ewsqaa_enabledControl",
			"fieldLabel": "Ewsqaa_fieldLabel",
			"builtinText": "Ewsqaa_builtinText",
			"root": "Ewsqaa_root",
			"rowHeader": "Ewsqaa_rowHeader",
			"intro": "Ewsqaa_intro",
			"status": "Ewsqaa_status",
			"builtins": "Ewsqaa_builtins"
		};
		//#endregion
		//#region src/client/PromptStudioView.tsx
		/** Unified prompt-component editor and request-layout preview. */
		const POSITION_ORDER = {
			after_system: 0,
			anchored: 1,
			tail: 2
		};
		const KIND_LABEL = {
			native: "原生",
			supplement: "补充"
		};
		const POSITION_LABEL = {
			after_system: "系统后",
			anchored: "最后用户输入后",
			tail: "请求尾部"
		};
		const ROLE_LABEL = {
			system: "system",
			user: "user",
			assistant: "assistant"
		};
		function copyComponents(components) {
			return components.map((component) => ({ ...component }));
		}
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function compareRows(left, right) {
			return POSITION_ORDER[left.component.position] - POSITION_ORDER[right.component.position] || left.component.order - right.component.order;
		}
		function previewText(system, supplements) {
			const blocks = [];
			const systemText = renderSystemPreview(system);
			if (systemText.length > 0) blocks.push(`[system]\n${systemText}`);
			const sortedSupplements = supplements.map((component, declaration) => ({
				component,
				declaration
			})).sort((left, right) => POSITION_ORDER[left.component.position] - POSITION_ORDER[right.component.position] || left.component.order - right.component.order || left.declaration - right.declaration);
			for (const { component } of sortedSupplements) blocks.push(`[${POSITION_LABEL[component.position]} · ${component.role} · ${component.id}]\n${component.template}`);
			return blocks.join("\n\n");
		}
		/** Conversation-view entry point. */
		function PromptStudioView({ controller, useSnapshot }) {
			const remote = useSnapshot((state) => state);
			(0, react.useEffect)(() => {
				if (remote.status === "idle") controller.load();
			}, [controller, remote.status]);
			if (remote.status === "idle" || remote.status === "loading" && remote.native.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PromptStudioView_module_css_default["status"],
				children: "正在载入 Prompt Studio…"
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
					children: "重试"
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptStudioEditor, {
				controller,
				remote
			});
		}
		function PromptStudioEditor({ controller, remote }) {
			const [draft, setDraft] = (0, react.useState)(() => copyComponents(remote.components));
			const [dirty, setDirty] = (0, react.useState)(false);
			const [editingIndex, setEditingIndex] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setDraft(copyComponents(remote.components));
				setDirty(false);
				setSaving(false);
				setSaveError(null);
				setEditingIndex((index) => index !== null && index < remote.components.length ? index : null);
			}, [
				remote.catalogRevision,
				remote.components,
				remote.revision
			]);
			const rows = (0, react.useMemo)(() => [...remote.native.map((component) => ({
				component,
				configuredIndex: null
			})), ...draft.map((component, configuredIndex) => ({
				component,
				configuredIndex
			}))].sort(compareRows), [draft, remote.native]);
			const draftSystem = (0, react.useMemo)(() => dirty ? buildDraftSystemComponents(remote.native, draft) : copyComponents(remote.assembled), [
				dirty,
				draft,
				remote.assembled,
				remote.native
			]);
			const requestSupplements = (0, react.useMemo)(() => {
				const nativeIds = new Set(remote.native.map((component) => component.id));
				return draft.filter((component) => component.enabled && (!isNativeOverride(component) || nativeIds.has(component.origin)));
			}, [draft, remote.native]);
			const preview = (0, react.useMemo)(() => previewText(draftSystem, requestSupplements), [draftSystem, requestSupplements]);
			const changeComponent = (index, patch) => {
				setDraft((current) => current.map((component, position) => position === index ? {
					...component,
					...patch
				} : component));
				setDirty(true);
				setSaveError(null);
			};
			const changeOrigin = (index, origin) => {
				setDraft((current) => current.map((component, position) => {
					if (position !== index) return component;
					const next = { ...component };
					if (origin.length === 0) delete next.origin;
					else next.origin = origin;
					return next;
				}));
				setDirty(true);
				setSaveError(null);
			};
			const addSupplement = () => {
				setDraft((current) => {
					const next = [...current, {
						id: nextSupplementId(current),
						kind: "supplement",
						position: "tail",
						role: "user",
						order: 100,
						enabled: true,
						template: ""
					}];
					setEditingIndex(next.length - 1);
					return next;
				});
				setDirty(true);
				setSaveError(null);
			};
			const addOverride = (native) => {
				const existing = draft.findIndex((component) => isNativeOverride(component) && component.origin === native.id);
				if (existing >= 0) {
					setEditingIndex(existing);
					return;
				}
				setDraft((current) => {
					const next = [...current, {
						id: nextOverrideId(current, native.id),
						kind: "supplement",
						position: "after_system",
						role: "system",
						order: native.order,
						enabled: true,
						template: native.template,
						origin: native.id
					}];
					setEditingIndex(next.length - 1);
					return next;
				});
				setDirty(true);
				setSaveError(null);
			};
			const removeComponent = (index) => {
				setDraft((current) => current.filter((_component, position) => position !== index));
				setEditingIndex((current) => {
					if (current === null || current === index) return null;
					return current > index ? current - 1 : current;
				});
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
							children: "统一编排只读原生组件与可编辑补充组件；角色、位置和原生覆盖目标彼此独立。"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PromptStudioView_module_css_default["headerActions"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: PromptStudioView_module_css_default["secondaryButton"],
								disabled: !remote.writable,
								onClick: addSupplement,
								children: "新增补充"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: PromptStudioView_module_css_default["primaryButton"],
								disabled: !dirty || saving || !remote.writable,
								onClick: save,
								children: saving ? "正在保存…" : "保存更改"
							})]
						})]
					}),
					!remote.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["notice"],
						children: "当前设置提供方为只读。"
					}) : null,
					remote.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["notice"],
						children: "正在刷新运行时组件…"
					}) : null,
					saveError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PromptStudioView_module_css_default["error"],
						children: saveError
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PromptStudioView_module_css_default["columns"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: PromptStudioView_module_css_default["editorColumn"],
							"aria-label": "统一提示词组件",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: PromptStudioView_module_css_default["sectionHeading"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: PromptStudioView_module_css_default["subtitle"],
									children: "组件"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: PromptStudioView_module_css_default["caption"],
									children: "原生组件来自运行时组装快照；补充组件保存后由统一效果管线撤销并重施加。"
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: PromptStudioView_module_css_default["count"],
									children: String(rows.length)
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
								className: PromptStudioView_module_css_default["componentList"],
								children: rows.map(({ component, configuredIndex }) => {
									const isNative = configuredIndex === null;
									const editing = configuredIndex !== null && editingIndex === configuredIndex;
									const override = isNativeOverride(component);
									const overrideExists = isNative && draft.some((item) => isNativeOverride(item) && item.origin === component.id);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: PromptStudioView_module_css_default["componentCard"],
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: PromptStudioView_module_css_default["rowHeader"],
												children: [
													isNative ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["stateBadge"],
														children: "运行时"
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["enabledControl"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: component.enabled,
															disabled: !remote.writable,
															onChange: (event) => {
																changeComponent(configuredIndex, { enabled: event.target.checked });
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: component.enabled ? "启用" : override ? "关闭原生" : "停用" })]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["kindBadge"],
														children: KIND_LABEL[component.kind]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["sectionName"],
														children: component.id
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["positionBadge"],
														children: POSITION_LABEL[component.position]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PromptStudioView_module_css_default["roleBadge"],
														children: component.role
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: PromptStudioView_module_css_default["orderBadge"],
														children: ["顺序 ", String(component.order)]
													}),
													isNative ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: PromptStudioView_module_css_default["textButton"],
														disabled: !remote.writable,
														onClick: () => {
															addOverride(component);
														},
														children: overrideExists ? "编辑覆盖" : "创建覆盖"
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: PromptStudioView_module_css_default["textButton"],
														onClick: () => {
															setEditingIndex(editing ? null : configuredIndex);
														},
														children: editing ? "收起" : "编辑"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: PromptStudioView_module_css_default["dangerButton"],
														disabled: !remote.writable,
														onClick: () => {
															removeComponent(configuredIndex);
														},
														children: override ? "恢复原生" : "删除"
													})] })
												]
											}),
											component.origin !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
												className: PromptStudioView_module_css_default["origin"],
												children: ["覆盖目标：", component.origin]
											}) : null,
											editing && configuredIndex !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: PromptStudioView_module_css_default["componentEditor"],
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "标识"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															className: PromptStudioView_module_css_default["input"],
															value: component.id,
															disabled: !remote.writable,
															onChange: (event) => {
																changeComponent(configuredIndex, { id: event.target.value });
															}
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "顺序"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															className: PromptStudioView_module_css_default["orderInput"],
															type: "number",
															value: component.order,
															disabled: !remote.writable,
															onChange: (event) => {
																changeComponent(configuredIndex, { order: Number(event.target.value) });
															}
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "位置"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
															className: PromptStudioView_module_css_default["select"],
															value: component.position,
															disabled: !remote.writable,
															onChange: (event) => {
																changeComponent(configuredIndex, { position: event.target.value });
															},
															children: Object.entries(POSITION_LABEL).map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value,
																children: label
															}, value))
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "角色"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
															className: PromptStudioView_module_css_default["select"],
															value: component.role,
															disabled: !remote.writable,
															onChange: (event) => {
																changeComponent(configuredIndex, { role: event.target.value });
															},
															children: Object.entries(ROLE_LABEL).map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value,
																children: label
															}, value))
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: PromptStudioView_module_css_default["field"],
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "覆盖目标"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: PromptStudioView_module_css_default["select"],
															value: component.origin ?? "",
															disabled: !remote.writable,
															onChange: (event) => {
																changeOrigin(configuredIndex, event.target.value);
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "",
																children: "不覆盖原生"
															}), remote.native.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: item.id,
																children: item.id
															}, item.id))]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: `${PromptStudioView_module_css_default["field"]} ${PromptStudioView_module_css_default["templateField"]}`,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: PromptStudioView_module_css_default["fieldLabel"],
															children: "模板"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
															className: PromptStudioView_module_css_default["textarea"],
															value: component.template,
															disabled: !remote.writable,
															rows: 8,
															onChange: (event) => {
																changeComponent(configuredIndex, { template: event.target.value });
															}
														})]
													})
												]
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: PromptStudioView_module_css_default["excerpt"],
												children: component.template || "（空模板）"
											})
										]
									}, `${component.kind}:${component.id}:${String(configuredIndex)}`);
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: PromptStudioView_module_css_default["previewColumn"],
							"aria-label": "完整请求预览",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PromptStudioView_module_css_default["sectionHeading"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: PromptStudioView_module_css_default["subtitle"],
										children: "完整预览"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: PromptStudioView_module_css_default["caption"],
										children: [
											"未解析模板；",
											"{{user_input}}",
											"、",
											"{{model}}",
											" 与 ",
											"{{cwd}}",
											" 在每次组装时读取当前会话。"
										]
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PromptStudioView_module_css_default["count"],
										children: [String(draftSystem.length + requestSupplements.length), " 项"]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PromptStudioView_module_css_default["assemblyOrder"],
									children: [draftSystem.map((component, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PromptStudioView_module_css_default["assemblyRow"],
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PromptStudioView_module_css_default["assemblyIndex"],
												children: String(index + 1)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: component.id }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PromptStudioView_module_css_default["assemblyOrderValue"],
												children: KIND_LABEL[component.kind]
											})
										]
									}, `system:${component.kind}:${component.id}:${String(index)}`)), requestSupplements.map((component) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PromptStudioView_module_css_default["assemblyRow"],
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PromptStudioView_module_css_default["assemblyIndex"],
												children: "＋"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: component.id }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: PromptStudioView_module_css_default["assemblyOrderValue"],
												children: [
													POSITION_LABEL[component.position],
													" · ",
													component.role
												]
											})
										]
									}, `supplement:${component.id}`))]
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