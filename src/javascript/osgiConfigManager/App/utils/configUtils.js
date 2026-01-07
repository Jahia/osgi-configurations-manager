/**
 * Helper to recursively parse incoming data and track property order
 */
export const parseData = (data) => {
    if (data === null || data === undefined) return { value: '', encrypted: false };

    if (Array.isArray(data)) {
        return data.map(item => parseData(item));
    }

    if (typeof data === 'object') {
        const result = {
            _order: Object.keys(data)
        };
        Object.entries(data).forEach(([k, v]) => {
            result[k] = parseData(v);
        });
        return result;
    }

    // Leaf node
    const val = String(data);
    const isEnc = val.startsWith('ENC(') && val.endsWith(')');
    return {
        value: val,
        encrypted: isEnc,
        decryptedValue: val,
        isLeaf: true
    };
};

/**
 * Helper to recursively prepare data for saving, removing metadata like _order
 */
export const prepareDataForSave = async (data, apiUrl) => {
    if (Array.isArray(data)) {
        return Promise.all(data.map(item => prepareDataForSave(item, apiUrl)));
    }

    if (data.isLeaf) {
        // It's a leaf node
        let valToSend = data.value || '';
        if (data.encrypted && !valToSend.startsWith('ENC(')) {
            // Needs encryption
            const encRes = await fetch(apiUrl, {
                method: 'POST',
                body: JSON.stringify({ action: 'encrypt', value: data.value })
            });
            const encData = await encRes.json();
            valToSend = encData.encryptedValue;
        }
        return valToSend;
    }

    const result = {};
    for (const [key, val] of Object.entries(data)) {
        if (key !== '_order') {
            result[key] = await prepareDataForSave(val, apiUrl);
        }
    }
    return result;
};

export const parseCfgContent = (content) => {
    const lines = content.split(/\r?\n/);
    return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') {
            return { type: 'empty' };
        }
        if (trimmed.startsWith('#')) {
            return { type: 'comment', value: line };
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
            return {
                type: 'property',
                key: line.substring(0, separatorIndex).trim(),
                value: line.substring(separatorIndex + 1).trim()
            };
        }

        return { type: 'comment', value: line };
    });
};


/**
 * Deeply update a value in the properties tree
 */
export const updateStateDeep = (obj, pathIdx, pathArray, field, value, isNewNode = false) => {
    const key = pathArray[pathIdx];

    if (pathIdx === pathArray.length - 1) {
        // We reached the target node
        if (Array.isArray(obj)) {
            const newArr = [...obj];
            const existing = obj[key] || {};
            newArr[key] = {
                ...existing,
                [field]: value,
                isLeaf: isNewNode ? (field === 'isLeaf' ? value : true) : (existing.isLeaf ?? true)
            };

            // Ensure isLeaf is explicitly false if we are creating a container
            if (isNewNode && (value === '{}' || value === '[]')) {
                newArr[key].isLeaf = false;
                newArr[key].value = undefined;
            }

            return newArr;
        }

        const isNewKey = obj[key] === undefined;
        const existing = obj[key] || {};
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
        newArr[key] = updateStateDeep(obj[key] || (isNaN(pathArray[pathIdx + 1]) ? {} : []), pathIdx + 1, pathArray, field, value);
        return newArr;
    }

    return {
        ...obj,
        [key]: updateStateDeep(obj[key] || (isNaN(pathArray[pathIdx + 1]) ? {} : []), pathIdx + 1, pathArray, field, value)
    };
};
