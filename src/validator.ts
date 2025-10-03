import { isFormatValid } from './string-format.ts';
import type { ErrorPath, JsonSchema, JsonSchemaPrimitive, ValidationResult, Validator } from './types.ts';

const OK: ValidationResult = { ok: true };

export function validator(schema: JsonSchema): Validator {
    return (data: unknown) => ({ ...validateNode(schema, [], data) });
}

function validateNode(schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    const typeSet = new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
    const dk = getDataKind(data);

    if (!typeSet.has(dk)) {
        const isInteger = dk === 'number' && typeSet.has('integer') && Number.isInteger(data);
        const expected = Array.from(typeSet).join(' or ');
        if (!isInteger) return fail(`Expected ${expected} but got ${dk}`, path, data);
    }

    if (isConstMismatch(schema, data)) {
        const expected = typeof schema.const === 'string' ? `'${schema.const}'` : schema.const;
        return fail(`Value must equal ${expected}`, path, data);
    }

    if (isEnumMismatch(schema, data)) {
        return fail('Value not in enum', path, data);
    }

    switch (dk) {
        case 'object': return validateObjectNode(schema, path, data);
        case 'array': return validateArrayNode(schema, path, data);
        case 'string': return validateStringNode(schema, path, data);
        case 'number': return validateNumberNode(schema, path, data);
        case 'boolean': return validateBooleanNode(schema, path, data);
        default: return OK;
    }
}

function validateObjectNode(schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];

    if (!isObject(data)) {
        return fail('Expected object', path, data);
    }
    for (const key of required) {
        if (!Object.hasOwn(data, key)) {
            return fail(`Missing required property '${key}'`, path);
        }
    }
    for (const [key, node] of Object.entries(properties)) {
        if (Object.hasOwn(data, key)) {
            const e = validateNode(node, path.concat(key), data[key]);
            if (e.ok === false) return e;
        }
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const [key, value] of Object.entries(data)) {
            if (!(key in properties)) {
                const e = validateNode(schema.additionalProperties, path.concat(key), value);
                if (e.ok === false) return e;
            }
        }
    } else if (schema.additionalProperties === false) {
        for (const key of Object.keys(data)) {
            if (!(key in properties)) {
                return fail(`Unexpected property '${key}'`, path);
            }
        }
    }

    return OK;
}

function validateArrayNode(schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    if (!Array.isArray(data)) {
        return fail('Expected array', path, data);
    }
    if (schema.minItems !== undefined && data.length < schema.minItems) {
        return fail(`Expected at least ${schema.minItems} items, got ${data.length}`, path, data.length);
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        return fail(`Expected at most ${schema.maxItems} items, got ${data.length}`, path, data.length);
    }
    if (schema.items) {
        for (let i = 0; i < data.length; i++) {
            const e = validateNode(schema.items, path.concat(i), data[i]);
            if (e.ok === false) return e;
        }
    }

    return OK;
}

function validateStringNode(schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    if (typeof data !== 'string') {
        return fail('Expected string', path, data);
    }
    if (schema.minLength !== undefined && data.length < schema.minLength) {
        return fail(`String length < ${schema.minLength}`, path, data.length);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        return fail(`String length > ${schema.maxLength}`, path, data.length);
    }
    if (schema.pattern) {
        const regExp = new RegExp(schema.pattern);
        if (!regExp.test(data)) {
            return fail(`String does not match pattern ${regExp}`, path, data);
        }
    }
    if (schema.format && !isFormatValid(schema.format, data)) {
        return fail(`Invalid ${schema.format} format`, path, data);
    }
    if (schema.not?.format && !isFormatValid(schema.not.format, data, false)) {
        return fail(`Must not be ${schema.not.format} format`, path, data);
    }

    return OK;
}

function validateNumberNode(schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    if (typeof data !== 'number' || !Number.isFinite(data)) {
        return fail(`Expected ${schema.type}`, path, data);
    }
    if (schema.type === 'integer' && !Number.isInteger(data)) {
        return fail('Expected integer', path, data);
    }
    if (schema.minimum !== undefined && data < schema.minimum) {
        return fail(`Must be >= ${schema.minimum}`, path, data);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
        return fail(`Must be <= ${schema.maximum}`, path, data);
    }
    if (schema.exclusiveMinimum !== undefined && !(data > schema.exclusiveMinimum)) {
        return fail(`Must be > ${schema.exclusiveMinimum}`, path, data);
    }
    if (schema.exclusiveMaximum !== undefined && !(data < schema.exclusiveMaximum)) {
        return fail(`Must be < ${schema.exclusiveMaximum}`, path, data);
    }

    return OK;
}

function validateBooleanNode(_schema: JsonSchema, path: ErrorPath, data: unknown): ValidationResult {
    if (typeof data !== 'boolean') {
        return fail('Expected boolean', path, data);
    }

    return OK;
}

function getDataKind(value: unknown) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function isConstMismatch(schema: JsonSchema, data: unknown) {
    return schema.const !== undefined && data !== schema.const;
}

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean']);
function isEnumMismatch(schema: JsonSchema, data: unknown) {
    if (!Array.isArray(schema.enum)) return false;
    if (data !== null && !PRIMITIVE_TYPES.has(typeof data)) return true;
    return !schema.enum.includes(data as JsonSchemaPrimitive);
}

function fail(message: string, path: ErrorPath, received?: unknown): ValidationResult {
    return { ok: false, path, message, received };
}

function isObject(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
}
