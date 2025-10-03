
export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
export type JsonSchemaPrimitive = string | number | boolean | null;

export interface JsonSchema {
    type: JsonSchemaType | readonly JsonSchemaType[];
    description?: string;

    // Object-ish
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;

    // Array-ish
    items?: JsonSchema;
    minItems?: number;
    maxItems?: number;

    // String-ish
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: StringFormat;
    not?: { format?: StringFormat };

    // Number-ish (number & integer)
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;

    // Cross-kind
    enum?: Array<JsonSchemaPrimitive>;
    const?: JsonSchemaPrimitive;
}

type StringFormat = 'uuid' | 'email' | 'uri' | 'hostname' | 'ipv4' | 'ipv6' | 'date-time' | 'date' | 'time' | (string & {});

export type Validator = (data: unknown) => ValidationResult;

export type ValidationResult = ValidationError | { ok: true };

export type ErrorPath = (string | number)[];

export type ValidationError = {
    ok: false;
    path: ErrorPath;
    message: string;
    received?: unknown;
};
