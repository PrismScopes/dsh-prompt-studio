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
/** Conversation-view placement: Chat is 0 and Trajectory is 10. */
const PROMPT_STUDIO_VIEW_ORDER = 20;
/** Initial order assigned to a newly added deployment section. */
const DEFAULT_USER_SECTION_ORDER = 200;
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
//#region src/config.ts
const finiteOrder = Schema.transform(Schema.number(), (value) => {
	if (!Number.isFinite(value)) throw new TypeError("prompt section order must be a finite number");
	return value;
}, true);
const sectionSchema = Schema.object({
	name: Schema.string().min(1),
	order: finiteOrder,
	enabled: Schema.boolean().default(true),
	text: Schema.string()
});
const uniqueSections = Schema.transform(Schema.array(sectionSchema), (sections) => {
	validateStudioSections(sections);
	return sections;
}, true);
const overrideSchema = sectionSchema;
const uniqueOverrides = Schema.transform(Schema.array(overrideSchema), (overrides) => {
	validateBuiltinOverrides(overrides);
	return overrides;
}, true);
/** Persisted settings schema for deployment rows and built-in replacements. */
const studioConfigSchema = Schema.object({
	sections: uniqueSections.default([]),
	overrides: uniqueOverrides.default([])
});
//#endregion
//#region src/index.ts
/** Branded Host settings key. */
const PROMPT_STUDIO_SETTINGS_NAMESPACE = PROMPT_STUDIO_NAMESPACE;
/** Stable Cordis plugin name. */
const name = "client-ui-prompt-studio";
/** Host services required before the namespace and sections can be installed. */
const inject = ["settings", "systemPrompt"];
function sameSection(left, right) {
	return left.name === right.name && left.order === right.order && left.text === right.text;
}
/** Maintains the exact enabled settings set in the system-prompt registry. */
var PromptSectionBindings = class {
	registry;
	active = /* @__PURE__ */ new Map();
	constructor(registry) {
		this.registry = registry;
	}
	replace(sections) {
		const next = new Map(sections.filter((section) => section.enabled).map((section) => [section.name, section]));
		const staged = this.stageAdditions(next);
		for (const [sectionName, active] of [...this.active]) {
			const replacement = next.get(sectionName);
			if (replacement === void 0) {
				active.dispose();
				this.active.delete(sectionName);
				continue;
			}
			if (sameSection(active.section, replacement)) continue;
			active.dispose();
			this.active.set(sectionName, this.install(replacement));
		}
		for (const [sectionName, active] of staged) this.active.set(sectionName, active);
	}
	dispose() {
		for (const active of this.active.values()) active.dispose();
		this.active.clear();
	}
	stageAdditions(next) {
		const staged = /* @__PURE__ */ new Map();
		try {
			for (const [sectionName, section] of next) if (!this.active.has(sectionName)) staged.set(sectionName, this.install(section));
			return staged;
		} catch (error) {
			for (const active of staged.values()) active.dispose();
			throw error;
		}
	}
	install(section) {
		const promptSection = {
			name: section.name,
			order: section.order,
			text: section.text
		};
		return {
			section: promptSection,
			dispose: this.registry.section(promptSection)
		};
	}
};
function markerName(sectionName) {
	return `${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}${sectionName}`;
}
function materializeOverrideMarkers(overrides) {
	return overrides.map((override) => ({
		name: markerName(override.name),
		order: override.order,
		enabled: true,
		text: override.enabled ? override.text : ""
	}));
}
/**
* Carries override order through the registry without colliding with an
* existing same-scope section such as a subagent persona. The assembly seam
* replaces each marker with its target, or removes both when the row is closed.
*/
var BuiltinOverrideBindings = class {
	markers;
	overridesByMarker = /* @__PURE__ */ new Map();
	constructor(registry) {
		this.markers = new PromptSectionBindings(registry);
	}
	replace(overrides) {
		validateBuiltinOverrides(overrides);
		const next = overrides.map((override) => ({ ...override }));
		this.markers.replace(materializeOverrideMarkers(next));
		this.overridesByMarker = new Map(next.map((override) => [markerName(override.name), override]));
	}
	apply(assembly) {
		if (this.overridesByMarker.size === 0) return;
		const presentNames = new Set(assembly.sections.map((section) => section.name));
		const replacedTargets = /* @__PURE__ */ new Set();
		for (const [name, override] of this.overridesByMarker) if (presentNames.has(name)) replacedTargets.add(override.name);
		assembly.sections = assembly.sections.flatMap((section) => {
			const override = this.overridesByMarker.get(section.name);
			if (override !== void 0) {
				if (!presentNames.has(override.name) || !override.enabled) return [];
				return [{
					name: override.name,
					text: section.text
				}];
			}
			return replacedTargets.has(section.name) ? [] : [section];
		});
	}
	dispose() {
		this.markers.dispose();
		this.overridesByMarker.clear();
	}
};
/** Register the live namespace and mirror its user rows and built-in replacements. */
function apply(ctx) {
	const scope = ctx.settings.register(PROMPT_STUDIO_SETTINGS_NAMESPACE, studioConfigSchema, { applies: "live" });
	const userBindings = new PromptSectionBindings(ctx.systemPrompt);
	const overrideBindings = new BuiltinOverrideBindings(ctx.systemPrompt);
	const initial = scope.get();
	validateStudioSections(initial.sections);
	userBindings.replace(initial.sections);
	overrideBindings.replace(initial.overrides);
	const stopOverriding = ctx.on("system-prompt/assemble", (assembly, _context, next) => {
		overrideBindings.apply(assembly);
		return next();
	}, { prepend: true });
	const stopWatching = scope.watch((next) => {
		validateStudioSections(next.sections);
		userBindings.replace(next.sections);
		overrideBindings.replace(next.overrides);
	});
	ctx.effect(() => () => {
		stopWatching();
		stopOverriding();
		overrideBindings.dispose();
		userBindings.dispose();
	}, "ui-prompt-studio: live prompt sections");
}
//#endregion
export { BUILTIN_SECTIONS, DEFAULT_USER_SECTION_ORDER, PROMPT_STUDIO_NAMESPACE, PROMPT_STUDIO_SETTINGS_NAMESPACE, PROMPT_STUDIO_VIEW_ORDER, apply, buildPreviewSections, inject, name, nextSectionName, renderPreview, resolveBuiltinSections, studioConfigSchema, validateBuiltinOverrides, validateStudioSections };
