//#region ../dsh/vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
//#endregion
//#region ../dsh/vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
//#endregion
//#region ../dsh/vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../dsh/vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region src/shared.ts
/** Settings namespace shared by the Host registration and browser editor. */
const PROMPT_STUDIO_NAMESPACE = "prompt-studio";
/** Same-origin endpoint exposing the runtime-discovered prompt inventory. */
const PROMPT_STUDIO_STATE_PATH = "/prompt-studio/state";
/** Conversation-view placement: Chat is 0 and Trajectory is 10. */
const PROMPT_STUDIO_VIEW_ORDER = 20;
/** Initial order assigned to a newly added supplement. */
const DEFAULT_SUPPLEMENT_ORDER = 100;
/** Namespace reserved for ordered replacement markers owned by the Host half. */
const PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX = "prompt-studio:override-marker:";
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
		if (!KINDS.has(component.kind)) throw new TypeError(`prompt component "${component.id}" has an invalid kind`);
		if (!POSITIONS.has(component.position)) throw new TypeError(`prompt component "${component.id}" has an invalid position`);
		if (!ROLES.has(component.role)) throw new TypeError(`prompt component "${component.id}" has an invalid role`);
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
//#region src/config.ts
const finiteOrder = Schema.transform(Schema.number(), (value) => {
	if (!Number.isFinite(value)) throw new TypeError("prompt component order must be a finite number");
	return value;
}, true);
const kindSchema = Schema.union([Schema.const("native"), Schema.const("supplement")]);
const positionSchema = Schema.union([
	Schema.const("after_system"),
	Schema.const("anchored"),
	Schema.const("tail")
]);
const roleSchema = Schema.union([
	Schema.const("system"),
	Schema.const("user"),
	Schema.const("assistant")
]);
const componentSchema = Schema.object({
	id: Schema.string().min(1),
	kind: kindSchema,
	role: roleSchema,
	position: positionSchema,
	order: finiteOrder,
	enabled: Schema.boolean().default(true),
	template: Schema.string(),
	origin: Schema.string().min(1).default(void 0)
});
const uniqueComponents = Schema.transform(Schema.array(componentSchema), (components) => {
	validatePromptComponents(components);
	return components;
}, true);
/** Persisted settings schema. Only user-authored supplements are stored. */
const studioConfigSchema = Schema.object({ components: uniqueComponents.default([]) });
//#endregion
//#region src/index.ts
/** Branded Host settings key. */
const PROMPT_STUDIO_SETTINGS_NAMESPACE = PROMPT_STUDIO_NAMESPACE;
/** Stable Cordis plugin name. */
const name = "client-ui-prompt-studio";
/** Host services required by the component and request pipelines. */
const inject = [
	"settings",
	"systemPrompt",
	"llm"
];
const REQUEST_SOURCE = "moeblack/prompt-studio";
function markerName(target) {
	return `${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}${target}`;
}
function cloneComponent(component) {
	return { ...component };
}
/** Live values contributed by currently active configuration effects. */
var RuntimeBindings = class {
	ownedSectionNames = /* @__PURE__ */ new Set();
	overridesByMarker = /* @__PURE__ */ new Map();
	supplements = /* @__PURE__ */ new Map();
	/** Activate one component and return its composed inverse. */
	activate(ctx, component) {
		if (component.kind === "native") throw new TypeError(`native prompt component "${component.id}" cannot be activated from settings`);
		if (isNativeOverride(component)) {
			const snapshot = {
				...component,
				origin: component.origin
			};
			const marker = markerName(snapshot.origin);
			return ctx.effect(function* () {
				this.ownedSectionNames.add(marker);
				this.overridesByMarker.set(marker, snapshot);
				if (snapshot.enabled) this.supplements.set(snapshot.id, snapshot);
				yield () => {
					this.supplements.delete(snapshot.id);
					this.overridesByMarker.delete(marker);
					this.ownedSectionNames.delete(marker);
				};
				yield ctx.systemPrompt.section({
					name: marker,
					order: snapshot.order,
					text: ""
				});
			}.bind(this), `prompt-studio: override ${snapshot.origin}`);
		}
		if (!component.enabled) return ctx.effect(() => () => void 0, `prompt-studio: disabled ${component.id}`);
		const snapshot = cloneComponent(component);
		return ctx.effect(function* () {
			this.supplements.set(snapshot.id, snapshot);
			yield () => {
				this.supplements.delete(snapshot.id);
			};
		}.bind(this), `prompt-studio: supplement ${component.id}`);
	}
};
/** Replaces a complete configuration by recovering and reapplying one composed effect. */
var ComponentPipeline = class {
	ctx;
	bindings;
	recover = () => void 0;
	constructor(ctx, bindings) {
		this.ctx = ctx;
		this.bindings = bindings;
	}
	replace(components) {
		validatePromptComponents(components);
		this.recover();
		const snapshots = components.map(cloneComponent);
		this.recover = this.ctx.effect(function* () {
			for (const component of snapshots) yield this.bindings.activate(this.ctx, component);
		}.bind(this), "prompt-studio: configured component set");
	}
};
function applyOverrides(assembly, overridesByMarker) {
	const matchedOverrideIds = /* @__PURE__ */ new Set();
	if (overridesByMarker.size === 0) return matchedOverrideIds;
	const presentNames = new Set(assembly.sections.map((section) => section.name));
	const replacedTargets = /* @__PURE__ */ new Set();
	for (const [marker, override] of overridesByMarker) {
		if (!presentNames.has(marker) || !presentNames.has(override.origin)) continue;
		replacedTargets.add(override.origin);
		matchedOverrideIds.add(override.id);
	}
	assembly.sections = assembly.sections.flatMap((section) => {
		if (overridesByMarker.get(section.name) !== void 0) return [];
		return replacedTargets.has(section.name) ? [] : [section];
	});
	return matchedOverrideIds;
}
function runtimeNative(sections, ownedSectionNames) {
	return sections.filter((section) => !ownedSectionNames.has(section.name)).map((section, order) => ({
		id: section.name,
		kind: "native",
		position: "after_system",
		role: "system",
		order,
		enabled: true,
		template: section.text
	}));
}
function effectiveAssembly(sections) {
	return sections.map((section, order) => ({
		id: section.name,
		kind: "native",
		position: "after_system",
		role: "system",
		order,
		enabled: true,
		template: section.text
	}));
}
/** Latest value-level snapshot of the runtime registry. */
var RuntimeCatalogStore = class {
	revision = 0;
	native = [];
	assembled = [];
	commit(native, assembled) {
		const nextNative = native.map(cloneComponent);
		const nextAssembled = assembled.map(cloneComponent);
		if (JSON.stringify(nextNative) === JSON.stringify(this.native) && JSON.stringify(nextAssembled) === JSON.stringify(this.assembled)) return;
		this.native = nextNative;
		this.assembled = nextAssembled;
		this.revision += 1;
	}
	snapshot() {
		return {
			revision: this.revision,
			native: this.native.map(cloneComponent),
			assembled: this.assembled.map(cloneComponent)
		};
	}
};
function latestUserInput(agent) {
	for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
		const event = agent.session.events[index];
		if (event?.type !== "user/message") continue;
		return event.data.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
	}
}
function liveVariables(agent) {
	return {
		user_input: latestUserInput(agent),
		model: agent.options.model,
		cwd: agent.session.header.cwd
	};
}
function renderComponentTemplate(component, agent) {
	const variables = liveVariables(agent);
	return component.template.replace(/\{\{([^{}]*)\}\}/g, (reference, name) => {
		if (!Object.hasOwn(variables, name)) throw new Error(`unknown prompt variable "${reference}" in component "${component.id}"`);
		const value = variables[name];
		if (value === void 0) throw new Error(`prompt variable "${reference}" has no value in component "${component.id}"`);
		return value;
	});
}
/** Request-owned supplementary plans materialized during the matching assembly. */
var SupplementPlans = class {
	bySession = /* @__PURE__ */ new Map();
	prepare(agent, components) {
		if (agent === void 0) return;
		const plan = components.map((component, declaration) => ({
			id: component.id,
			position: component.position,
			role: component.role,
			order: component.order,
			text: renderComponentTemplate(component, agent),
			declaration
		})).sort((left, right) => left.order - right.order || left.declaration - right.declaration);
		if (plan.length === 0) {
			this.bySession.delete(String(agent.session.id));
			return;
		}
		this.bySession.set(String(agent.session.id), plan);
	}
	take(sessionId) {
		const plan = this.bySession.get(sessionId);
		this.bySession.delete(sessionId);
		return plan;
	}
	clear() {
		this.bySession.clear();
	}
};
function supplementalMessage(supplement) {
	return Object.freeze({
		id: crypto.randomUUID(),
		role: supplement.role,
		content: Object.freeze([Object.freeze({
			type: "text",
			text: supplement.text
		})]),
		source: Object.freeze({
			kind: "plugin",
			plugin: REQUEST_SOURCE
		})
	});
}
function insertSupplements(nativeMessages, plan) {
	const afterSystem = plan.filter((item) => item.position === "after_system").map(supplementalMessage);
	const anchored = plan.filter((item) => item.position === "anchored").map(supplementalMessage);
	const tail = plan.filter((item) => item.position === "tail").map(supplementalMessage);
	let anchor = -1;
	for (let index = nativeMessages.length - 1; index >= 0; index -= 1) {
		const message = nativeMessages[index];
		if (message?.role === "user" && message.source.kind === "user") {
			anchor = index;
			break;
		}
	}
	const result = [...afterSystem];
	for (let index = 0; index < nativeMessages.length; index += 1) {
		const message = nativeMessages[index];
		if (message !== void 0) result.push(message);
		if (index === anchor) result.push(...anchored);
	}
	result.push(...tail);
	return result;
}
function rewriteRequest(ctx, plans, options, next) {
	if (!(options.sessionId !== void 0 && options.purpose === void 0 && Object.isFrozen(options) && Object.isFrozen(options.messages)) || options.sessionId === void 0) return next();
	const plan = plans.take(String(options.sessionId));
	if (plan === void 0) return next();
	const messages = insertSupplements(options.messages, plan);
	Object.freeze(messages);
	const rewritten = Object.freeze({
		...options,
		messages
	});
	return ctx.llm.stream(rewritten);
}
function installCatalogRoute(ctx, catalog) {
	ctx.inject(["httpServer"], (routeCtx) => {
		routeCtx.effect(() => routeCtx.httpServer.register({
			kind: "exact",
			path: PROMPT_STUDIO_STATE_PATH,
			handler: (request, response) => {
				if (request.method !== "GET" && request.method !== "HEAD") {
					response.writeHead(405);
					response.end();
					return;
				}
				const body = JSON.stringify(catalog.snapshot());
				response.writeHead(200, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				response.end(request.method === "HEAD" ? void 0 : body);
			}
		}), "prompt-studio: runtime catalog route");
	});
}
/** Register the live namespace and unified component pipeline. */
async function apply(ctx) {
	const scope = ctx.settings.register(PROMPT_STUDIO_SETTINGS_NAMESPACE, studioConfigSchema, { applies: "live" });
	const bindings = new RuntimeBindings();
	const pipeline = new ComponentPipeline(ctx, bindings);
	const catalog = new RuntimeCatalogStore();
	const plans = new SupplementPlans();
	ctx.systemPrompt.variable("user_input", (context) => context.agent === void 0 ? void 0 : latestUserInput(context.agent));
	ctx.on("system-prompt/assemble", async (assembly, context, next) => {
		const native = runtimeNative(assembly.sections, bindings.ownedSectionNames);
		const matchedOverrideIds = applyOverrides(assembly, bindings.overridesByMarker);
		const resolved = await next();
		catalog.commit(native, effectiveAssembly(resolved.sections));
		plans.prepare(context.agent, [...bindings.supplements.values()].filter((component) => !isNativeOverride(component) || matchedOverrideIds.has(component.id)));
		return resolved;
	}, { prepend: true });
	let refreshRequested = false;
	let refreshTask;
	const requestRefresh = () => {
		refreshRequested = true;
		if (refreshTask !== void 0) return;
		refreshTask = (async () => {
			while (refreshRequested) {
				refreshRequested = false;
				await ctx.systemPrompt.assemble();
			}
		})().catch((error) => {
			ctx.logger.warn("prompt-studio: runtime prompt discovery failed");
			ctx.logger.warn(error);
		}).finally(() => {
			refreshTask = void 0;
			if (refreshRequested) requestRefresh();
		});
	};
	ctx.on("system-prompt/change", requestRefresh);
	ctx.on("llm/stream", (options, next) => rewriteRequest(ctx, plans, options, next));
	ctx.effect(() => () => {
		plans.clear();
	}, "prompt-studio: supplementary request plans");
	installCatalogRoute(ctx, catalog);
	const initial = scope.get();
	validatePromptComponents(initial.components);
	pipeline.replace(initial.components);
	ctx.effect(() => scope.watch((next) => {
		validatePromptComponents(next.components);
		pipeline.replace(next.components);
	}), "prompt-studio: settings component source");
	await ctx.systemPrompt.assemble();
}
//#endregion
export { DEFAULT_SUPPLEMENT_ORDER, PROMPT_STUDIO_NAMESPACE, PROMPT_STUDIO_SETTINGS_NAMESPACE, PROMPT_STUDIO_STATE_PATH, PROMPT_STUDIO_VIEW_ORDER, apply, buildDraftSystemComponents, inject, isNativeOverride, name, nextOverrideId, nextSupplementId, renderSystemPreview, studioConfigSchema, validatePromptComponents };
