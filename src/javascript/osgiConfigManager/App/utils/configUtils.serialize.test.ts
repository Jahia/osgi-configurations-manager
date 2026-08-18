import {
    parseCfgContent,
    toCfgFormat,
    parseData,
    prepareDataForSave,
    updateStateDeep,
    isDeepEqual
} from './configUtils';

// Characterization tests for the parse/serialize engine that the visual <-> raw
// editor and the planned dual-representation refactor depend on.

describe('toCfgFormat <-> parseCfgContent round-trip (array mode)', () => {
    test('property, comment and empty lines survive a parse + serialize cycle', () => {
        const input = 'a = 1\n# a comment\n\nb = 2\n';

        const result = toCfgFormat(parseCfgContent(input));

        expect(result).toBe(input);
    });

    test('parseCfgContent flags an ENC(...) value as encrypted and keeps the wrapper', () => {
        const [entry] = parseCfgContent('secret = ENC(abc123)\n');

        expect(entry.type.value).toBe('property');
        expect(entry.key.value).toBe('secret');
        expect(entry.value.value).toBe('ENC(abc123)');
        expect(entry.value.encrypted).toBe(true);
    });

    test('toCfgFormat prefixes a bare comment value with "# "', () => {
        const arr = [{ type: { value: 'comment' }, value: { value: 'no hash prefix' } }];

        expect(toCfgFormat(arr)).toBe('# no hash prefix\n');
    });
});

describe('parseData <-> prepareDataForSave round-trip (object tree)', () => {
    test('nested object survives parse + prepare', async () => {
        const original = { a: '1', b: { c: '2' } };

        const parsed = parseData(original);
        const prepared = await prepareDataForSave(parsed);

        expect(prepared).toEqual(original);
    });

    test('parseData marks an ENC(...) leaf as encrypted', () => {
        const parsed: any = parseData({ token: 'ENC(xyz)' });

        expect(parsed.token.isLeaf).toBe(true);
        expect(parsed.token.encrypted).toBe(true);
        expect(parsed.token.value).toBe('ENC(xyz)');
    });

    test('parseData records insertion order in _order', () => {
        const parsed: any = parseData({ first: '1', second: '2' });

        expect(parsed._order).toEqual(['first', 'second']);
    });
});

describe('updateStateDeep', () => {
    test('updates a nested leaf value without mutating the original tree', () => {
        const original: any = { _order: ['a'], a: { value: '1', isLeaf: true } };

        const updated = updateStateDeep(original, 0, ['a'], 'value', '9');

        expect(updated.a.value).toBe('9');
        expect(original.a.value).toBe('1'); // immutability preserved
    });

    test('appends a brand-new key to _order', () => {
        const original: any = { _order: ['a'], a: { value: '1', isLeaf: true } };

        const updated = updateStateDeep(original, 0, ['b'], 'value', '', true);

        expect(updated._order).toEqual(['a', 'b']);
        expect(updated.b.isLeaf).toBe(true);
    });
});

describe('isDeepEqual', () => {
    test('returns true for structurally equal objects with arrays', () => {
        expect(isDeepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true);
    });

    test('returns false when a nested value differs', () => {
        expect(isDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
});
