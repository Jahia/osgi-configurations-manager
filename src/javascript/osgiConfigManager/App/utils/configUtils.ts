

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
    const lines = content.split(/\r?\n/);
    // Fix: Strings ending in \n produce a trailing empty string in split().
    // We should ignore this specific empty string to avoid creating an "empty" node for the EOF.
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') {
            return { type: { value: 'empty', isLeaf: true } };
        }
        if (trimmed.startsWith('#')) {
            return { type: { value: 'comment', isLeaf: true }, value: { value: line, isLeaf: true } };
        }

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

            // Direct Encryption Check
            // Relaxed check: Just looking for ENC( prefix. 
            // Strict endsWith(')') can fail if there are trailing invisible chars or minor malformations,
            // resulting in accidental decryption/cleartext exposure in Text Mode.
            if (value.startsWith('ENC(')) {
                isEncrypted = true;
            }

            return {
                type: { value: 'property', isLeaf: true },
                key: { value: key, isLeaf: true },
                value: { value: value, isLeaf: true, encrypted: isEncrypted }
            };
        }

        return { type: { value: 'comment', isLeaf: true }, value: { value: line, isLeaf: true } };
    });
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
                return `${key} = ${value}`;
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
    lines = flatProps.map(p => `${p.key} = ${p.value}`);
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
