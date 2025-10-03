import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    isDate,
    isDateTime,
    isEmail,
    isFormatValid,
    isHostname,
    isIpv4,
    isIpv6,
    isTime,
    isUri,
    isUuid,
} from '../src/string-format.ts';

describe('uuid', () => {
    test('valid v4', () => {
        assert.ok(isUuid('123e4567-e89b-12d3-a456-426614174000'));
        assert.ok(isFormatValid('uuid', '123e4567-e89b-12d3-a456-426614174000'));
    });

    test('invalid', () => {
        assert.ok(!isUuid('123e4567e89b12d3a456426614174000')); // missing dashes
        assert.ok(!isUuid('123e4567-e89b-12d3-a456-42661417400Z')); // non-hex
    });
});

describe('email', () => {
    test('valid', () => {
        assert.ok(isEmail('user.name+tag@sub.example.co.uk'));
        assert.ok(isFormatValid('email', 'a@b.co'));
    });

    test('invalid', () => {
        assert.ok(!isEmail('a@b'));
        assert.ok(!isEmail('a b@c.d'));
    });
});

describe('uri', () => {
    test('valid with authority', () => {
        assert.ok(isUri('https://example.com/path?x=1#hash'));
        assert.ok(isFormatValid('uri', 'ftp://example.com/file.txt'));
    });

    test('valid without authority (non-http schemes)', () => {
        assert.ok(isUri('mailto:joe@example.com'));
        assert.ok(isUri('urn:uuid:123e4567-e89b-12d3-a456-426614174000'));
        assert.ok(isUri('data:text/plain,hi'));
    });

    test('invalid / missing host for authority schemes', () => {
        assert.ok(!isUri('http:///nohost'));
        assert.ok(!isUri('https:///path-only'));
        assert.ok(!isFormatValid('uri', 'ftp:///oops'));
    });

    test('garbage', () => {
        assert.ok(!isUri('://bad'));
        assert.ok(!isFormatValid('uri', 'not a url'));
    });
});

describe('hostname', () => {
    test('valid', () => {
        assert.ok(isHostname('example.com'));
        assert.ok(isHostname('sub.example.co'));
    });

    test('invalid', () => {
        assert.ok(!isHostname('-bad.com')); // starts with hyphen
        assert.ok(!isHostname('bad-.com')); // ends with hyphen
        const longLabel = 'a'.repeat(64);
        assert.ok(!isHostname(`${longLabel}.com`)); // label > 63
        const longHost = 'a'.repeat(254);
        assert.ok(!isHostname(longHost)); // hostname > 253
    });
});

describe('ipv4', () => {
    test('valid', () => {
        assert.ok(isIpv4('192.168.0.1'));
        assert.ok(isIpv4('255.255.255.255'));
    });

    test('invalid', () => {
        assert.ok(!isIpv4('256.0.0.1'));
        assert.ok(!isIpv4('1.2.3'));
    });
});

describe('ipv6', () => {
    test('valid', () => {
        assert.ok(isIpv6('2001:db8:85a3:0:0:8a2e:370:7334'));
        assert.ok(isIpv6('2001:db8::8a2e:370:7334')); // compressed
    });

    test('invalid', () => {
        assert.ok(!isIpv6('2001::85a3::8a2e:370:7334')); // double ::
        assert.ok(!isIpv6('12345::')); // too many hex digits
    });
});

describe('date-time (RFC3339)', () => {
    test('valid', () => {
        assert.ok(isDateTime('2025-10-02T13:45:00Z'));
        assert.ok(isDateTime('2025-10-02T13:45:00.123Z'));
        assert.ok(isDateTime('2025-10-02T13:45:00+02:00'));
    });

    test('invalid', () => {
        assert.ok(!isDateTime('2025-13-01T00:00:00Z')); // invalid month
        assert.ok(!isDateTime('2025-10-02T25:00:00Z')); // invalid hour
        assert.ok(!isDateTime('2025-10-02 13:45:00Z')); // space instead of T
    });
});

describe('date (RFC3339 full-date)', () => {
    test('valid', () => {
        assert.ok(isDate('2024-02-29')); // leap day
    });

    test('invalid', () => {
        assert.ok(!isDate('2025-00-10')); // invalid month
        assert.ok(!isDate('2025-10-32')); // invalid day
    });
});

describe('time (RFC3339 full-time-ish)', () => {
    test('valid', () => {
        assert.ok(isTime('00:00:00'));
        assert.ok(isTime('23:59:59'));
        assert.ok(isTime('12:00:00.500Z'));
        assert.ok(isTime('12:00:00+02:00'));
    });

    test('invalid', () => {
        assert.ok(!isTime('24:00:00'));
        assert.ok(!isTime('12:60:00'));
        assert.ok(!isTime('12:00:60'));
        assert.ok(!isTime('12:00')); // missing seconds
    });
});

describe('isFormatValid wrapper', () => {
    test('known format happy path', () => {
        assert.equal(isFormatValid('email', 'a@b.co'), true);
        assert.equal(isFormatValid('email', 'a@b.co', true), true);
        assert.equal(isFormatValid('email', 'not-an-email', true), false);
    });

    test('not.format semantics via expected=false', () => {
        // When expected=false, a valid email should return false (because it *is* an email).
        assert.equal(isFormatValid('email', 'a@b.co', false), false);
        // And a non-email should return true (it meets the "not email" expectation).
        assert.equal(isFormatValid('email', 'not-an-email', false), true);
    });

    test('unknown formats are ignored (always valid)', () => {
        assert.equal(isFormatValid('totally-made-up', 'anything'), true);
        assert.equal(isFormatValid('totally-made-up', 'anything', false), true);
    });
});
