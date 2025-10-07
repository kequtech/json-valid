# @kequtech/json-valid

A tiny JSON validator with a pragmatic simple subset of JSON Schema / OpenAPI 3.1 features when you don't need everything. **First error wins** (short-circuits on the first mismatch), clear error paths, and a simple API.

* Validate `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`
* Supports **type unions** (e.g. `['string','null']`, `['object','string']`)
* Common string **formats** (`uuid`, `email`, `uri`, `hostname`, `ipv4`, `ipv6`, `date-time`, `date`, `time`)
* `additionalProperties` as **boolean** or **schema**
* `enum`/`const` with strict equality

---

## Install

```bash
npm i @kequtech/json-valid
```
ESM only.

---

## Quick start

```ts
import { type JsonSchema, validator } from '@kequtech/json-valid';

const User: JsonSchema = {
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

validateUser({ id: 1, email: 'a@b.co' });
// { ok: true }
validateUser({ id: 1, email: null });
// { ok: true }
validateUser({ id: 0, email: 'a@b.co' });
// { ok: false, path: ['id'], message: 'Must be >= 1', received: 0 }
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

> Curried validation logic `validator(schema)(data)`. If you need a throwing variant, wrap the result and throw on `!ok`.

---

## Supported schema (subset)

This library uses a single, pragmatic **schema shape** with a `type` that can be a single kind or a union of kinds:

```ts
type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
type JsonSchemaPrimitive = string | number | boolean | null;
type StringFormat = 'uuid' | 'email' | 'uri' | 'hostname' | 'ipv4' | 'ipv6' | 'date-time' | 'date' | 'time';

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
  pattern?: string;
  format?: StringFormat;
  not?: { format?: StringFormat };

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

### Not supported

`multipleOf`, `minProperties`, `maxProperties`, `propertyNames`, `patternProperties`, `if`,`then`, `else`, `dependentRequired`, `dependentSchemas`, `oneOf`, `allOf`, `anyOf`,`prefixItems`, `contains`, `uniqueItems`, `$ref`.

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
* `format` / `not.format`
  * Known formats are validated; **unknown formats are ignored** (treated as pass)

Supported formats: `uuid`, `email`, `uri`, `hostname`, `ipv4`, `ipv6`, `date-time`, `date`, `time`.

Also accessible in exports: `isUuid`, `isEmail`, `isUri`, `isHostname`, `isIpv4`, `isIpv6`, `isDateTime`, `isDate`, `isTime`.

### `enum` and `const`

* **Strict equality** (no coercion).
* `enum` and `const` are **primitives only** (`string | number | boolean | null`).
  If you set `const` and the value is object/array, it fails. Use the exact primitive and include it's value as valid `type`.
* `type: ['string','null']` with `const: 'hello'` **does not** allow `null` — only `'hello'`. Similar with `enum: ['hello', null]` — `null` must be included.

---

## Error paths

Paths are arrays of keys/indices:

```ts
const List: JsonSchema = {
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

const validateList = validator(Schema);

validateList({ users: [{ email: 'ok@x.io' }, {}] });
// { ok: false, path: ['users', 1], message: "Missing required property 'email'" }

validateList({ users: [{ email: 'nope' }] });
// { ok: false, path: ['users', 0, 'email'], message: 'Invalid email format' }
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
const validateIntegerArray = validator({
  type: 'array',
  minItems: 1,
  maxItems: 3,
  items: { type: 'integer' },
});

validateIntegerArray([1, 2]);
// { ok: true }
validateIntegerArray([]);
// { ok: false, path: [], message: 'Expected at least 1 items', received: 0 }
validateIntegerArray([1, 2, 3, 4]);
// { ok: false, path: [], message: 'Expected at most 3 items', received: 4 }
validateIntegerArray([1, 2.5]);
// { ok: false, path: [1], message: 'Expected integer', received: 2.5 }
```

### Cross-family union

```ts
const validateObjectOrString = validator({
  type: ['object','string'],
  // object facet
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
  additionalProperties: false,
  // string facet
  minLength: 2,
  pattern: 'ok',
});

validateObjectOrString({ id: 2 });
// { ok: true }
validateObjectOrString('ok');
// { ok: true }
validateObjectOrString('o');
// { ok: false, path: [], message: 'String length must be >= 2', received: 1 }
validateObjectOrString({ id: 0 });
// { ok: false, path: ['id'], message: 'Must be >= 1', received: 0 }
```

---

## Design choices & notes

* **First error wins**: stops at the first mismatch for speed and clarity.
* **Unknown formats**: treated as pass (open-world; your schema stays portable).
* **No** `uniqueItems`, `$ref`, `oneOf`, `allOf`, `anyOf`, etc (so far, by design).
* **Const/enum are primitives only**: object/array currently not supported.

---

## Contributing

Issues welcome. Keep it small, clear, and fast.
Tests use Node’s built-in runner `node:test` and `node:assert`.

```bash
npm test
```
