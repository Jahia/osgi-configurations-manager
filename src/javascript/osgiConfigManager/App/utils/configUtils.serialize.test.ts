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

describe('multiline values keep a "\\" continuation marker', () => {
    // A .cfg value cannot span raw lines: every continued line must end with a backslash.
    // Values READ from a file already carry it, because the parser keeps the backslash it saw.
    // Values TYPED in the visual editor do not — the textarea yields a bare "\n" — and writing
    // that out unchanged produced a line with no separator, which the parser then classified as a
    // comment and the next save prefixed with "# ". The user's value silently became a comment.

    test('a value typed with a bare newline is written with " \\" continuations', () => {
        const arr = [{
            type: { value: 'property' },
            key: { value: 'multi.key' },
            value: { value: 'first\nsecond' }
        }];

        expect(toCfgFormat(arr)).toBe('multi.key = first \\\nsecond\n');
    });

    test('the result reparses as ONE property, not a property plus a comment', () => {
        const arr = [{
            type: { value: 'property' },
            key: { value: 'multi.key' },
            value: { value: 'first\nsecond' }
        }];

        const reparsed = toCfgFormat(arr);
        const nodes = parseCfgContent(reparsed);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].type.value).toBe('property');
        expect(nodes[0].key.value).toBe('multi.key');
        expect(nodes[0].value.value).toBe('first \\\nsecond');
    });

    test('saving twice is stable — the second save does not add another backslash', () => {
        const arr = [{
            type: { value: 'property' },
            key: { value: 'multi.key' },
            value: { value: 'first\nsecond' }
        }];

        const once = toCfgFormat(arr);
        const twice = toCfgFormat(parseCfgContent(once));

        expect(twice).toBe(once);
    });

    test('a value already carrying continuations is left byte-identical', () => {
        // The visual <-> raw round-trip invariant: a file-loaded value must not be rewritten.
        const input = 'multi.key = first \\\n    second\n';

        expect(toCfgFormat(parseCfgContent(input))).toBe(input);
    });

    test('a line ending in an escaped backslash still gets a continuation', () => {
        // "path\\" is an escaped backslash, an EVEN count, so it is not a continuation marker:
        // one must still be added, or the next line is orphaned.
        const arr = [{
            type: { value: 'property' },
            key: { value: 'win.path' },
            value: { value: 'C:\\\\\nnext' }
        }];

        expect(toCfgFormat(arr)).toBe('win.path = C:\\\\ \\\nnext\n');
    });

    test('a trailing newline does not leave a dangling continuation', () => {
        const arr = [{
            type: { value: 'property' },
            key: { value: 'trail.key' },
            value: { value: 'only\n' }
        }];

        // Nothing follows, so there is nothing to continue onto.
        expect(toCfgFormat(arr)).toBe('trail.key = only\n');
    });

    test('the object-tree path gets the same treatment', () => {
        const tree: any = { _order: ['multi'], multi: { isLeaf: true, value: 'first\nsecond' } };

        expect(toCfgFormat(tree)).toBe('multi = first \\\nsecond\n');
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
