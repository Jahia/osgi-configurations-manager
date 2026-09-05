

export interface ConfigNode {
    value?: string;
    encrypted?: boolean;
    decryptedValue?: string;
    isLeaf?: boolean;
    _order?: string[];
    [key: string]: any;
}

export interface ParseResult {
    type: 'empty' | 'comment' | 'property';
    key?: string;
    value?: string;
    encrypted?: boolean;
}

/**
 * Helper to recursively parse incoming data and track property order
 */
export const parseData = (data: any): ConfigNode => {
    if (data === null || data === undefined) return { value: '', encrypted: false };

    if (Array.isArray(data)) {
        return (data as any[]).map(item => parseData(item));
    }

    if (typeof data === 'object') {
        const result: ConfigNode = {
            _order: Object.keys(data)
        };
        Object.entries(data).forEach(([k, v]) => {
            result[k] = parseData(v);
        });
        return result;
    }

    // Leaf node
    const val = String(data);
    // In Direct Encryption model, we just check if it starts with ENC( to flag it in UI
    const isEnc = val.startsWith('ENC(');

    return {
        value: val, // Keep exact value (including ENC(...) wrapper if present)
        encrypted: isEnc,
        isLeaf: true
    };
};

/**
 * Helper to recursively prepare data for saving, removing metadata like _order
 */
export const prepareDataForSave = async (data: any): Promise<any> => {
    // Prevent infinite recursion on primitives (strings, numbers, null, etc.)
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    if (Array.isArray(data)) {
        return Promise.all(data.map(item => prepareDataForSave(item)));
    }

    if (data.isLeaf) {
        // Direct Encryption: Save exactly what is in the value field.
        // The user Interaction handles the encryption transformation.
        return data.value || '';
    }

    const result: any = {};
    for (const [key, val] of Object.entries(data)) {
        if (key !== '_order') {
            result[key] = await prepareDataForSave(val);
        }
    }
    return result;
};

export const parseCfgContent = (content: string): any[] => {
    const rawLines = content.split(/\r?\n/);
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
    }

    const results: any[] = [];
    let logicalLine = '';
    let inContinuation = false;

    // Helper to count trailing backslashes to detect escaped backslash vs continuation
    const countTrailingBackslashes = (str: string): number => {
        let count = 0;
        let i = str.length - 1;
        while (i >= 0 && str[i] === '\\') {
            count++;
            i--;
        }
        return count;
    };

    const parsePropertyLine = (line: string) => {
        // Edge case: if continuation resulted in empty line, treat as empty?
        // But invalid property usually.

        let separatorIndex = -1;
        const eqIndex = line.indexOf('=');
        const colIndex = line.indexOf(':');

        if (eqIndex !== -1 && colIndex !== -1) {
            separatorIndex = Math.min(eqIndex, colIndex);
        } else if (eqIndex !== -1) {
            separatorIndex = eqIndex;
        } else {
            separatorIndex = colIndex;
        }

        if (separatorIndex !== -1) {
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();
            let isEncrypted = false;

            if (value.startsWith('ENC(')) {
                isEncrypted = true;
            }

            return {
                type: { value: 'property', isLeaf: true },
                key: { value: key, isLeaf: true },
                value: { value: value, isLeaf: true, encrypted: isEncrypted }
            };
        }

        // If it looks like a property but has no separator, it's treated as comment by original code?
        // Or maybe just invalid property text. Original code returned comment type.
        return { type: { value: 'comment', isLeaf: true }, value: { value: line, isLeaf: true } };
    };

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const trimmed = line.trim();

        // Check for comment or empty line
        // NOTE: Standard Props says "Natural line ... is comment if starts with # or !". 
        // These are ignored and do not participate in continuation.
        if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
            results.push({
                type: { value: 'comment', isLeaf: true },
                value: { value: line, isLeaf: true }
            });
            continue;
        }

        if (trimmed === '') {
            results.push({ type: { value: 'empty', isLeaf: true } });
            continue;
        }

        // It is a content line
        if (inContinuation) {
            // Continuation behavior: 
            // Standard Properties spec trims leading whitespace. 
            // BUT user wants to preserve file layout/indentation in Visual Mode.
            // Since standard parser IGNORES this whitespace anyway, it is safe to keep it in the string 
            // so that when we write it back, the indentation is preserved.
            logicalLine += line; // Do not trimStart()
        } else {
            logicalLine = line;
        }

        // Check for continuation marker
        const slashCount = countTrailingBackslashes(logicalLine);
        // Odd number of slashes means the last one is NOT escaped, so it IS a continuation
        if (slashCount % 2 === 1) {
            inContinuation = true;
            // Preserving behavior: keep backslash and append newline
            logicalLine += '\n';
        } else {
            inContinuation = false;
            // Parse completed logical line
            results.push(parsePropertyLine(logicalLine));
            logicalLine = '';
        }
    }

    // Flush remaining
    if (inContinuation && logicalLine !== '') {
        results.push(parsePropertyLine(logicalLine));
    }

    return results;
};


/**
 * Deeply update a value in the properties tree
 */
export const updateStateDeep = (obj: any, pathIdx: number, pathArray: (string | number)[], field: string, value: any, isNewNode: boolean = false): any => {
    const key = pathArray[pathIdx];

    if (pathIdx === pathArray.length - 1) {
        // We reached the target node
        if (Array.isArray(obj)) {
            const newArr = [...obj];
            const existing = newArr[key as number] || {};
            newArr[key as number] = {
                ...existing,
                [field]: value,
                isLeaf: isNewNode ? (field === 'isLeaf' ? value : true) : (existing.isLeaf ?? true)
            };

            // Ensure isLeaf is explicitly false if we are creating a container
            if (isNewNode && (value === '{}' || value === '[]')) {
                newArr[key as number].isLeaf = false;
                newArr[key as number].value = undefined;
            }

            return newArr;
        }

        const isNewKey = obj[key] === undefined;
        let existing = obj[key] || {};

        // Fix: If existing is a primitive (string) or has no structure but we are adding a field,
        // we must convert it to an object structure { value: primitive } first.
        if (typeof existing !== 'object' || existing === null) {
            existing = { value: existing, isLeaf: true };
        }

        const nextObj = {
            ...obj,
            [key]: {
                ...existing,
                [field]: value,
                isLeaf: isNewNode ? (field === 'isLeaf' ? value : true) : (existing.isLeaf ?? true)
            }
        };

        // Ensure isLeaf is explicitly false if we are creating a container
        if (isNewNode && (value === '{}' || value === '[]')) {
            nextObj[key].isLeaf = false;
            nextObj[key].value = undefined;
        }

        // If it's a new property and we have an order list, update it
        if (isNewKey && obj._order && !obj._order.includes(key)) {
            nextObj._order = [...obj._order, key];
        }

        return nextObj;
    }

    // Traverse deeper
    if (Array.isArray(obj)) {
        const newArr = [...obj];
        // @ts-ignore
        newArr[key] = updateStateDeep(obj[key] || (isNaN(pathArray[pathIdx + 1] as number) ? {} : []), pathIdx + 1, pathArray, field, value);
        return newArr;
    }

    return {
        ...obj,
        [key]: updateStateDeep(obj[key] || (isNaN(pathArray[pathIdx + 1] as number) ? {} : []), pathIdx + 1, pathArray, field, value)
    };
};

/**
 * Converts the properties object back to a .cfg text format for display in Diff View.
 * It attempts to respect the _order if present, otherwise sorts alphabetically.
 */
/**
 * Count the backslashes ending a string. An ODD count means the last one escapes the line break,
 * i.e. it is an active continuation marker; an EVEN count means they escape each other.
 */
const countTrailingBackslashes = (str: string): number => {
    let count = 0;
    let i = str.length - 1;
    while (i >= 0 && str[i] === '\\') {
        count++;
        i--;
    }
    return count;
};

/**
 * Give every continued line of a value its trailing "\" marker.
 *
 * A .cfg value cannot span raw lines. Without the marker the next line is read as a separate
 * entry, and having no "=" separator, parseCfgContent classifies it as a comment — after which
 * the next save prefixes it with "# " and the tail of the value is silently lost.
 *
 * Values PARSED FROM A FILE already carry their markers, because parseCfgContent keeps the
 * backslash it saw. Those must come back out untouched, or the visual <-> raw round-trip stops
 * being byte-identical. Values TYPED in the visual editor arrive as a bare "\n" and need one.
 * Testing the marker rather than the origin covers both without having to tell them apart.
 */
const withLineContinuations = (key: string, value: any): any => {
    if (typeof value !== 'string' || !value.includes('\n')) {
        return value;
    }

    // Continued lines are lined up under the start of the value, so the raw view of a saved file
    // reads as a block instead of falling back to column 0. The visual editor has no "format"
    // button, so saving is the only moment this layout can be applied.
    //
    // This is cosmetic, not semantic: a properties reader discards the leading whitespace of a
    // continuation line, so the value Karaf sees is the same with or without it. Existing leading
    // whitespace is stripped before the padding is applied, which is what makes saving twice a
    // no-op instead of indenting a little further each time.
    const indent = ' '.repeat(`${key} = `.length);

    const lines = value.split('\n');
    // A value ending in a newline has no following line to continue onto; emitting a marker there
    // would dangle, and the parser would meet an empty line while still expecting a continuation.
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    return lines.map((line, index) => {
        // On CRLF input the terminator is "\r\n", so both the padding and the marker belong
        // before the "\r".
        const hasCr = line.endsWith('\r');
        let body = hasCr ? line.slice(0, -1) : line;

        if (index > 0) {
            // Only ordinary indentation is stripped. A line starting with "\ " escapes a space the
            // author meant to keep, and does not begin with whitespace, so it is left alone.
            body = indent + body.replace(/^[ \t]+/, '');
        }

        if (index < lines.length - 1) {
            body += countTrailingBackslashes(body) % 2 === 1 ? '' : ' \\';
        }

        return body + (hasCr ? '\r' : '');
    }).join('\n');
};

export const toCfgFormat = (data: any): string => {
    if (!data) return '';
    if (Array.isArray(data)) {
        return data.map(item => {
            const type = item.type?.value || item.type;
            const key = item.key?.value || item.key;
            // Handle value which might be a complex object (encrypted) or simple wrapped value
            let value = item.value?.value ?? item.value;
            // Direct Encryption: No auto wrapping needed if value is already ENC(...)

            // If value is null/undefined, ensure empty string
            if (value === undefined || value === null) value = '';

            if (type === 'empty') return '';
            if (type === 'comment') {
                const val = value || '';
                return val.trim().startsWith('#') ? val : '# ' + val;
            }
            if (type === 'property') {
                // Direct Encryption: Value IS the string.
                return `${key} = ${withLineContinuations(key, value)}`;
            }
            // Fallback for unknown types or mixed structures
            return '';
        }).join('\n') + '\n';
    }

    let lines: string[] = [];

    const flatten = (obj: any, prefix = ''): { key: string, value: any }[] => {
        let result: { key: string, value: any }[] = [];
        const keys = obj._order || Object.keys(obj).sort();

        for (const key of keys) {
            if (key === '_order') continue;
            const val = obj[key];
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (val && typeof val === 'object' && !val.isLeaf) {
                result = result.concat(flatten(val, fullKey));
            } else {
                // It's a leaf or value
                let displayVal = val;
                if (val && typeof val === 'object' && val.isLeaf) {
                    displayVal = val.value;
                }
                result.push({ key: fullKey, value: displayVal });
            }
        }
        return result;
    };

    const flatProps = flatten(data);
    lines = flatProps.map(p => `${p.key} = ${withLineContinuations(p.key, p.value)}`);
    return lines.join('\n') + '\n';
};
// Basic deep equal
export const isDeepEqual = (x: any, y: any): boolean => {
    if (x === y) return true;
    if (x === null || x === undefined || y === null || y === undefined) return x === y;
    if (typeof x !== typeof y) return false;

    if (x instanceof Date && y instanceof Date) return x.getTime() === y.getTime();
    if (x instanceof RegExp && y instanceof RegExp) return x.toString() === y.toString();

    if (Array.isArray(x) && Array.isArray(y)) {
        if (x.length !== y.length) return false;
        for (let i = 0; i < x.length; i++) {
            if (!isDeepEqual(x[i], y[i])) return false;
        }
        return true;
    }

    if (typeof x === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
        const kx = Object.keys(x);
        const ky = Object.keys(y);
        if (kx.length !== ky.length) return false;
        for (const k of kx) {
            if (!Object.prototype.hasOwnProperty.call(y, k)) return false;
            if (!isDeepEqual(x[k], y[k])) return false;
        }
        return true;
    }

    return false;
};
