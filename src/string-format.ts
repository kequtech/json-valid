export function isFormatValid(format: string, data: string, expected = true): boolean {
    switch (format) {
        case 'uuid': return isUuid(data) === expected;
        case 'email': return isEmail(data) === expected;
        case 'uri': return isUri(data) === expected;
        case 'hostname': return isHostname(data) === expected;
        case 'ipv4': return isIpv4(data) === expected;
        case 'ipv6': return isIpv6(data) === expected;
        case 'date-time': return isDateTime(data) === expected;
        case 'date': return isDate(data) === expected;
        case 'time': return isTime(data) === expected;
        default: return true;
    }
}

export function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isUri(value: string): boolean {
    try {
        const url = new URL(value);
        if (!url.protocol) return false;
        if (['http:', 'https:', 'ftp:'].includes(url.protocol)) {
            const prefix = `${url.protocol}//`;
            if (!value.startsWith(prefix) || value.charAt(prefix.length) === '/') return false;
            return url.hostname.length > 0;
        }
        return true;
    } catch {
        return false;
    }
}

export function isHostname(value: string): boolean {
    if (value.length > 253) return false;
    const label = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
    return value.split('.').every(part => label.test(part));
}

export function isIpv4(value: string): boolean {
    return /^(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})$/.test(value);
}

export function isIpv6(value: string): boolean {
    return /^((?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:|:(?::[A-Fa-f0-9]{1,4}){1,7}|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|[A-Fa-f0-9]{1,4}:(?::[A-Fa-f0-9]{1,4}){1,6})(?:%.+)?$/.test(value);
}

export function isDateTime(value: string): boolean {
    return /^(?:\d{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value);
}

export function isDate(value: string): boolean {
    return /^(?:\d{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value);
}

export function isTime(value: string): boolean {
    return /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value);
}
