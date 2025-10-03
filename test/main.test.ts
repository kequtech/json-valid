import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ErrorPath, ValidationResult } from '../src/types.ts';
import { validator } from '../src/validator.ts';

function pass(result: ValidationResult) {
    assert.equal(result.ok, true, 'expected validation to pass');
}

function fail(result: ValidationResult, msg: RegExp | string, path: ErrorPath = []) {
    assert.equal(result.ok, false, 'expected validation to fail');
    if (msg instanceof RegExp) assert.match(result.message, msg);
    else assert.equal(result.message, msg);
    assert.deepEqual(result.path, path);
}

describe('validate() basics', () => {
    test('nullable: allowed vs not allowed', () => {
        const v1 = validator({ type: ['string', 'null'] });
        const v2 = validator({ type: 'string' });
        pass(v1(null));
        fail(v2(null), 'Expected string but got null', []);
    });

    test('boolean with const', () => {
        const v = validator({ type: 'boolean', const: true, description: 'must be true' });
        pass(v(true));
        fail(v(false), /Value must equal true/, []);
    });
});

describe('object validation', () => {
    test('required and type checking', () => {
        const v = validator({
            type: 'object',
            required: ['id', 'email'],
            additionalProperties: false,
            properties: {
                id: { type: 'integer', minimum: 1 },
                email: { type: 'string', format: 'email' },
            },
        });
        pass(v({ id: 1, email: 'a@b.co' }));
        // missing required
        fail(v({ id: 1 }), /Missing required property 'email'/, []);
        // wrong type nested path
        fail(v({ id: 0, email: 'a@b.co' }), /Must be >= 1/, ['id']);
        // unexpected property
        fail(v({ id: 1, email: 'a@b.co', extra: true }), /Unexpected property 'extra'/, []);
    });

    test('additionalProperties as schema (typed map)', () => {
        const v = validator({
            type: 'object',
            properties: {},
            additionalProperties: { type: 'string' },
        });
        pass(v({ a: 'x', b: 'y' }));
        fail(v({ a: 123 }), /Expected string/, ['a']);
    });

    test('nested object inside array: error path points to element', () => {
        const v = validator({
            type: 'object',
            properties: {
                users: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['email'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                        },
                    },
                },
            },
        });
        // Missing required property in the second item -> path ["users", 1]
        fail(v({ users: [{ email: 'ok@x.io' }, {}] }), /Missing required property 'email'/, ['users', 1]);
        // Bad format in the first item -> path ["users", 0, "email"]
        fail(v({ users: [{ email: 'nope' }] }), /Invalid email format/, ['users', 0, 'email']);
    });
});

describe('array validation', () => {
    test('minItems / maxItems / items', () => {
        const v = validator({
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: { type: 'integer' },
        });
        pass(v([1]));
        fail(v([]), /at least 1 items/, []);
        fail(v([1, 2, 3]), /at most 2 items/, []);
        fail(v([1, '2']), /Expected integer/, [1]);
    });

    test('no items schema: element types are not checked', () => {
        const v = validator({ type: 'array', minItems: 1 });
        pass(v([1, 'two', true, null]));
    });
});

describe('string validation', () => {
    test('minLength / maxLength', () => {
        const v = validator({ type: 'string', minLength: 2, maxLength: 3 });
        pass(v('ab'));
        fail(v('a'), /String length < 2/, []);
        fail(v('abcd'), /String length > 3/, []);
    });

    test('pattern (anchored)', () => {
        const v = validator({ type: 'string', pattern: 'ab' });
        pass(v('ab'));
        // fails because we anchor pattern internally
        fail(v('xxabxx'), /does not match pattern/, []);
    });

    test('enum and const', () => {
        const v1 = validator({ type: 'string', enum: ['red', 'green'] });
        pass(v1('green'));
        fail(v1('blue'), /Value not in enum/, []);
        const v2 = validator({ type: 'string', const: 'fixed' });
        pass(v2('fixed'));
        fail(v2('other'), /Value must equal 'fixed'/, []);
    });

    test('format and not.format', () => {
        const v1 = validator({ type: 'string', format: 'email' });
        pass(v1('a@b.co'));
        fail(v1('not-an-email'), /Invalid email format/, []);
        const v2 = validator({ type: 'string', not: { format: 'email' } });
        pass(v2('not-an-email'));
        fail(v2('a@b.co'), /Must not be email format/, []);
    });
});

describe('number/integer validation', () => {
    test('integer vs number', () => {
        const v1 = validator({ type: 'integer' });
        const v2 = validator({ type: 'number' });
        pass(v1(3));
        fail(v1(3.1), /Expected integer/, []);
        pass(v2(3.1));
    });

    test('bounds: inclusive/exclusive', () => {
        const v = validator({
            type: 'number',
            minimum: 1,
            maximum: 10,
            exclusiveMinimum: 2,
            exclusiveMaximum: 9,
        });
        fail(v(0.9), /Must be >= 1/, []);
        // At inclusive min but not > exclusiveMin
        fail(v(2), /Must be > 2/, []);
        // At inclusive max but not < exclusiveMax
        fail(v(9), /Must be < 9/, []);
        pass(v(5));
    });

    test('enum and const', () => {
        const v1 = validator({ type: 'number', enum: [1, 2, 3] });
        pass(v1(2));
        fail(v1(4), /Value not in enum/, []);
        const v2 = validator({ type: 'integer', const: 7 });
        pass(v2(7));
        fail(v2(8), /Value must equal 7/, []);
    });
});

describe('additionalProperties = undefined (extras allowed)', () => {
    test('extras pass by default', () => {
        const v = validator({
            type: 'object',
            properties: { id: { type: 'integer' } }, // no additionalProperties specified
        });
        pass(v({ id: 1, other: 'ok' }));
    });
});

describe('additionalProperties as schema with explicit property override', () => {
    test('explicit property schema takes precedence over AP schema', () => {
        const v = validator({
            type: 'object',
            properties: { id: { type: 'integer' } },
            additionalProperties: { type: 'string' },
        });
        pass(v({ id: 123, tag: 'ok' }));
        fail(v({ id: 'nope', tag: 'ok' }), /Expected integer/, ['id']);
    });
});

describe('nullable nested values', () => {
    test('nullable property', () => {
        const v = validator({
            type: 'object',
            properties: {
                email: { type: ['string', 'null'], format: 'email' },
            },
        });
        pass(v({ email: null }));
    });

    test('array of nullable items', () => {
        const v = validator({
            type: 'array',
            items: { type: ['number', 'null'] },
        });
        pass(v([1, null, 2]));
    });
});

describe('nested unexpected property path (AP=false inside array)', () => {
    test('path points to array index', () => {
        const v = validator({
            type: 'object',
            properties: {
                list: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { id: { type: 'integer' } },
                        additionalProperties: false,
                    },
                },
            },
        });
        // error path is at the object level of the 2nd item (index 1)
        fail(v({ list: [{ id: 1 }, { id: 2, extra: 1 }] }), /Unexpected property 'extra'/, ['list', 1]);
    });
});

describe('pattern anchoring (explicit ^$)', () => {
    test('explicitly anchored pattern still treated as whole-string', () => {
        const v = validator({ type: 'string', pattern: '^ab$' });
        pass(v('ab'));
        fail(v('zab'), /does not match pattern/, []);
        fail(v('abz'), /does not match pattern/, []);
    });
});

describe('format: unknown formats are ignored (open format)', () => {
    test('format: unknown -> passes', () => {
        const v = validator({ type: 'string', format: 'my-custom' });
        pass(v('anything'));
    });

    test('not.format: unknown -> passes', () => {
        const v = validator({ type: 'string', not: { format: 'also-custom' } });
        pass(v('anything'));
    });
});

describe('number edge cases', () => {
    test('NaN and Infinity rejected', () => {
        const v = validator({ type: 'number' });
        fail(v(Number.NaN), /Expected number/, []);
        fail(v(Number.POSITIVE_INFINITY), /Expected number/, []);
    });

    test('exclusive bounds take precedence at the boundary', () => {
        const v = validator({
            type: 'number',
            minimum: 1,
            exclusiveMinimum: 5,
            maximum: 10,
            exclusiveMaximum: 9,
        });
        // exactly at exclusive min -> fail
        fail(v(5), /Must be > 5/, []);
        // exactly at exclusive max -> fail
        fail(v(9), /Must be < 9/, []);
        // inside strict bounds -> ok
        pass(v(7));
    });
});

describe('arrays: items omitted', () => {
    test('no items schema -> type-only validation on elements', () => {
        const v = validator({ type: 'array', minItems: 1 });
        pass(v([1, 'x', true, null]));
    });
});

describe('object required with prototype properties', () => {
    test('required considers own properties only', () => {
        const proto = { x: 1 };
        const obj = Object.create(proto);
        const v = validator({
            type: 'object',
            required: ['x'],
            properties: { x: { type: 'integer' } },
        });
        // "x" is only on the prototype -> should fail required
        fail(v(obj), /Missing required property 'x'/, []);
    });
});

describe('string: length vs pattern ordering', () => {
    test('length errors fire before pattern', () => {
        const v = validator({ type: 'string', minLength: 2, maxLength: 3, pattern: 'ab' });
        fail(v('abcd'), /String length > 3/, []);
    });

    test('pattern fails when within length bounds', () => {
        const v = validator({ type: 'string', minLength: 2, maxLength: 3, pattern: 'ab' });
        fail(v('zab'), /does not match pattern/, []);
    });
});

describe('baseline type errors', () => {
    test('object type mismatch', () => {
        const v = validator({ type: 'object' });
        fail(v('not-an-object'), /Expected object/, []);
    });

    test('array type mismatch', () => {
        const v = validator({ type: 'array' });
        fail(v({}), /Expected array/, []);
    });

    test('boolean type mismatch', () => {
        const v = validator({ type: 'boolean' });
        fail(v('true'), /Expected boolean/, []);
    });
});

describe('optional vs required properties', () => {
    test('omitting non-required property is OK', () => {
        const v = validator({
            type: 'object',
            properties: {
                id: { type: 'integer' },
                nick: { type: 'string' }, // not in required
            },
            required: ['id'],
            additionalProperties: false,
        });
        pass(v({ id: 1 }));
    });

    test('required not in properties, AP allowed -> OK', () => {
        const v = validator({
            type: 'object',
            properties: { nick: { type: 'string' } },
            required: ['id'],
        });
        pass(v({ id: 1 }));
    });

    test('AP=false with no properties forbids everything', () => {
        const v = validator({
            type: 'object',
            additionalProperties: false,
            // properties omitted (i.e., none allowed)
        });
        fail(v({ any: 1 }), /Unexpected property 'any'/, []);
    });

    test('AP=true explicitly allows extras', () => {
        const v = validator({
            type: 'object',
            properties: { id: { type: 'integer' } },
            additionalProperties: true,
        });
        pass(v({ id: 1, extra: 'ok' }));
    });
});

describe('nullability inside arrays', () => {
    test('null not allowed when items not nullable', () => {
        const v = validator({
            type: 'array',
            items: { type: 'string' }, // not nullable
        });
        fail(v(['ok', null]), /Expected string but got null/, [1]);
    });
});

describe('const exactness', () => {
    test('number const does not coerce', () => {
        const v = validator({ type: 'number', const: 1 });
        fail(v('1'), /Expected number/, []);
    });

    test('boolean const exact', () => {
        const v = validator({ type: 'boolean', const: false });
        fail(v(true), /Value must equal false/, []);
    });
});

describe('pattern only vs length only', () => {
    test('pattern-only error message (no length constraints)', () => {
        const v = validator({ type: 'string', pattern: 'ab' });
        fail(v('x'), /does not match pattern/, []);
    });

    test('length-only errors never mention pattern', () => {
        const v = validator({ type: 'string', minLength: 3, maxLength: 3 });
        fail(v('xx'), /String length < 3/, []);
        fail(v('xxxx'), /String length > 3/, []);
    });
});

describe('nested property path', () => {
    test('invalid email bubbles path to users.0.email', () => {
        const v = validator({
            type: 'object',
            properties: {
                users: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            email: { type: 'string', format: 'email' },
                        },
                        required: ['email'],
                        additionalProperties: false,
                    },
                },
            },
        });
        fail(v({ users: [{ email: 'not-an-email' }] }), /Invalid email format/, ['users', 0, 'email']);
    });
});

describe('primitive unions: string | number', () => {
    test('applies the right keyword set per runtime type', () => {
        const v = validator({
            type: ['string', 'number'],
            minLength: 2, // string-only
            minimum: 10, // number-only
        });

        pass(v('ok')); // string passes minLength
        fail(v('x'), /String length < 2/, []); // string fails minLength
        pass(v(12)); // number passes minimum
        fail(v(5), /Must be >= 10/, []); // number fails minimum
    });

    test('enum/const strict equality across types', () => {
        const v1 = validator({ type: ['string', 'number'], enum: ['a', 1] });
        pass(v1('a'));
        pass(v1(1));
        fail(v1('1'), /Value not in enum/, []);
        fail(v1(2), /Value not in enum/, []);

        const v2 = validator({ type: ['string', 'number'], const: 5 });
        pass(v2(5));
        fail(v2('5'), /Value must equal 5/, []);
    });
});

describe('integer | number union behavior', () => {
    test('decimals allowed when number is present', () => {
        const v = validator({ type: ['integer', 'number'] });
        pass(v(3));
        pass(v(3.5)); // should be allowed because 'number' is present
    });

    test('integer alone still rejects decimals', () => {
        const v = validator({ type: 'integer' });
        fail(v(3.5), /Expected integer/, []);
    });
});

describe('object | null at top-level', () => {
    test('null bypasses required checks; object enforces them', () => {
        const v = validator({
            type: ['object', 'null'],
            required: ['id'],
            properties: { id: { type: 'integer' } },
            additionalProperties: false,
        });

        pass(v(null)); // allowed by union
        fail(v({}), /Missing required property 'id'/, []); // object path enforced
        pass(v({ id: 1 })); // valid object
    });
});

describe('array | null at top-level', () => {
    test('null bypasses item/minItems checks; array enforces them', () => {
        const v = validator({
            type: ['array', 'null'],
            minItems: 1,
            items: { type: 'string' },
        });

        pass(v(null));
        fail(v([]), /at least 1 items/, []);
        pass(v(['x']));
    });
});

describe('irrelevant keywords are ignored', () => {
    test('string-only keywords on object do nothing', () => {
        const v = validator({
            type: 'object',
            minLength: 3, // irrelevant for object
            pattern: '^x+$', // irrelevant for object
            properties: { a: { type: 'integer' } },
            required: ['a'],
            additionalProperties: false,
        });
        pass(v({ a: 1 })); // should not fail due to string keywords
    });

    test('object-only keywords on string do nothing', () => {
        const v = validator({
            type: 'string',
            properties: { a: { type: 'integer' } }, // irrelevant for string
            required: ['a'], // irrelevant for string
            additionalProperties: false, // irrelevant for string
            minLength: 1,
        });
        pass(v('x'));
    });
});

describe('cross-family union: object | string', () => {
    test('runs object checks for objects, string checks for strings', () => {
        const v = validator({
            type: ['object', 'string'],
            // object facet
            properties: { id: { type: 'integer', minimum: 1 } },
            required: ['id'],
            additionalProperties: false,
            // string facet
            minLength: 2,
            pattern: 'ok',
        });

        // object branch
        pass(v({ id: 2 }));
        fail(v({ id: 0 }), /Must be >= 1/, ['id']); // object check fires
        // string branch
        pass(v('ok'));
        fail(v('o'), /String length < 2/, []); // string check fires
        fail(v('zz'), /does not match pattern/, []); // pattern applies
    });
});

describe('items with integer | null reject decimals', () => {
    test('array decimals fail when items allow only integer or null', () => {
        const v = validator({
            type: 'array',
            items: { type: ['integer', 'null'] },
        });

        pass(v([1, null, 2]));
        fail(v([1.5]), /Expected integer/, [0]); // decimal rejected
    });
});

describe('enum/const with null in union', () => {
    test('null in enum allowed only when type includes null', () => {
        const v1 = validator({ type: ['string', 'null'], enum: ['a', null] });
        pass(v1('a'));
        pass(v1(null));
        fail(v1('b'), /Value not in enum/, []);

        const v2 = validator({ type: 'string', enum: ['a', null] }); // enum contains null, but type doesn't
        pass(v2('a'));
        // null still fails at type layer
        fail(v2(null), /Expected string but got null/, []);
    });

    test('const null allowed only with null in type', () => {
        const v1 = validator({ type: ['string', 'null'], const: null });
        pass(v1(null));
        fail(v1('x'), /Value must equal null/, []);

        const v2 = validator({ type: 'string', const: null });
        fail(v2('x'), /Value must equal null/, []);
    });
});

describe('null in const or enum', () => {
    test('enum + null: must include null explicitly', () => {
        const v1 = validator({ type: ['string', 'null'], enum: ['a'] });
        fail(v1(null), /Value not in enum/);
        const v2 = validator({ type: ['string', 'null'], enum: ['a', null] });
        pass(v2(null));
    });

    test('const + null: const wins', () => {
        const v = validator({ type: ['string', 'null'], const: 'hello' });
        fail(v(null), /Value must equal 'hello'/);
        pass(v('hello'));
    });
});
