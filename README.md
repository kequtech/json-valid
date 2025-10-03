# @kequtech/json-valid

A tiny JSON validator with a pragmatic subset of JSON Schema / OpenAPI 3.1 features.
**First error wins** (short-circuits on the first mismatch), clear error paths, and a simple API.

* Supports **type unions** (e.g. `['string','null']`, `['object','string']`)
* Validates **objects, arrays, strings, numbers, integers, booleans, null**
* Common string **formats** (`uuid`, `email`, `uri`, `hostname`, `ipv4`, `ipv6`, `date-time`, `date`, `time`)
* `additionalProperties` as **boolean** or **schema**
* `pattern` is treated as **anchored** (whole-string match)
* `enum`/**`const`** with **strict equality**
* Minimal surface area, no code generation step, no `$ref`/`oneOf`/`allOf`

---

## Install

```bash
npm i @kequtech/json-valid
```

ESM only.

---

## Quick start

```ts
import { validator } from '@kequtech/json-valid';

const User = {
  type: 'object',
  required: ['id', 'email'],
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    // allow null OR a valid email
    email: { type: ['string', 'null'], format: 'email' },
  },
};

const validateUser = validator(User);

validateUser({ id: 1, email: 'a@b.co' }); // => { ok: true }
validateUser({ id: 1, email: null });     // => { ok: true }

const r = validateUser({ id: 0, email: 'a@b.co' });
// r = { ok: false, path: ['id'], message: 'Must be >= 1', received: 0 }
```

**First error wins:** validation stops at the first mismatch and returns that error, including the JSON path to the offending value.

---

## API

### `validator(schema) => (data) => ValidationResult`

Creates a validator function for a given schema.

**ValidationResult**

```ts
type ErrorPath = (string | number)[];

type ValidationError = {
  ok: false;
  path: ErrorPath;
  message: string;
  received?: unknown;
};

type ValidationResult = ValidationError | { ok: true };
```

> Prefer the curried form `validator(schema)(data)` for clarity. If you need a throwing variant, wrap the result and throw on `!ok`.

---

## Supported schema (subset)

This library uses a single, pragmatic **schema shape** (call it `JsonSchema`) with a `type` that can be a single kind or a union of kinds:

```ts
type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
type JsonSchemaPrimitive = string | number | boolean | null;

// Accept a single kind or an array of kinds.

// Root
interface JsonSchema {
  type: JsonSchemaType | readonly JsonSchemaType[];
  description?: string;

  // Objects
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;

  // Arrays
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;

  // Strings
  minLength?: number;
  maxLength?: number;
  pattern?: string; // anchored by the validator (whole string)
  format?: 'uuid' | 'email' | 'uri' | 'hostname' | 'ipv4' | 'ipv6' | 'date-time' | 'date' | 'time';
  not?: { format?: JsonSchema['format'] };

  // Numbers (applies to 'number' and 'integer')
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;

  // Cross-kind
  enum?: JsonSchemaPrimitive[];
  const?: JsonSchemaPrimitive;
}
```

### Type unions

* Add `'null'` to **allow null**: `type: ['string', 'null']`
* Cross-family unions are allowed: e.g. `type: ['object','string']`
* **Integer nuance:** `type: 'integer'` accepts only integers; `type: 'number'` accepts integers and decimals.

### Objects

* `properties` — map of property schemas
* `required` — list of required property names
* `additionalProperties`

  * `false` → no extras allowed
  * `true`/`undefined` → extras allowed (no type check)
  * **schema** → typed map (extras validated against this schema)

### Arrays

* `items` — schema applied to each element (omit to allow any)
* `minItems` / `maxItems`

### Strings

* `minLength`, `maxLength`, `pattern`

  * `pattern` is **anchored** internally (equivalent to `^(?:pattern)$`)
* `format` / `not.format`

  * Known formats are validated; **unknown formats are ignored** (treated as pass)

Supported formats: `uuid`, `email`, `uri`, `hostname`, `ipv4`, `ipv6`, `date-time`, `date`, `time`.

Accessible by export if needed: `isUuid`, `isEmail`, `isUri`, `isHostname`, `isIpv4`, `isIpv6`, `isDateTime`, `isDate`, `isTime`.

### `enum` and `const`

* **Strict equality** (no coercion).
* `enum` and `const` are **primitives only** (`string | number | boolean | null`).
  If you set `const` and the value is object/array, it fails. Use the exact primitive and include it's value as valid `type`.
* `type: ['string','null']` with `const: 'hello'` **does not** allow `null` — only `'hello'`. Similar with `enum: ['hello', null]` — `null` must be included to allow it.

---

## Error paths

Paths are arrays of keys/indices:

```ts
const Schema = {
  type: 'object',
  properties: {
    users: {
      type: 'array',
      items: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
    },
  },
};

const validate = validator(Schema);

validate({ users: [{ email: 'ok@x.io' }, {}] });
// -> { ok: false, path: ['users', 1], message: "Missing required property 'email'" }

validate({ users: [{ email: 'nope' }] });
// -> { ok: false, path: ['users', 0, 'email'], message: 'Invalid email format' }
```

---

## Examples

### Additional properties as a typed map

```ts
const validateTags = validator({
  type: 'object',
  properties: {},
  additionalProperties: { type: 'string' },
});

validateTags({ a: 'x', b: 'y' });
// { ok: true }
validateTags({ a: 1 });
// { ok: false, path: ['a'], message: 'Expected string' }
```

### Array size and item checks

```ts
const validateIntArray = validator({
  type: 'array',
  minItems: 1,
  maxItems: 3,
  items: { type: 'integer' },
});

validateIntArray([1, 2]);
// { ok: true }
validateIntArray([]);
// { ok: false, path: [], message: 'Expected at least 1 items, got 0', received: 0 }
validateIntArray([1, 2, 3, 4]);
// { ok: false, path: [], message: 'Expected at most 3 items, got 4', received: 4 }
validateIntArray([1, 2.5]);
// { ok: false, path: [1], message: 'Expected integer', received: 2.5 }
```

### Cross-family union

```ts
const validateObjOrString = validator({
  type: ['object','string'],
  // object facet
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
  additionalProperties: false,
  // string facet
  minLength: 2,
  pattern: 'ok',
});

validateObjOrString({ id: 2 });
// { ok: true }
validateObjOrString('ok');
// { ok: true }
validateObjOrString('o');
// { ok: false, path: [], message: 'String length < 2', received: 1 }
validateObjOrString({ id: 0 });
// { ok: false, path: ['id'], message: 'Must be >= 1', received: 0 }
```

---

## Design choices & notes

* **First error wins**: stops at the first mismatch for speed and clarity.
* **Anchored patterns**: patterns are whole-string matches by default.
* **Unknown formats**: treated as pass (open-world; your schema stays portable).
* **No** `uniqueItems`, `$ref`, `oneOf`, `allOf`, `anyOf` (so far by design).
* **Enums are primitives only**: if you set `enum` and supply an object/array, it fails.

---

## Contributing

Issues and PRs welcome. Keep it small, clear, and fast.
Tests use Node’s built-in runner (`node:test`) and `node:assert`.

```bash
npm test
```

---
