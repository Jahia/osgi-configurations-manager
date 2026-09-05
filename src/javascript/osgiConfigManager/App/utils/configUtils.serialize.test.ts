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

describe('multiline values: continuation markers and alignment', () => {
    // A .cfg value cannot span raw lines: every continued line must end with a backslash.
    // Values READ from a file already carry it, because the parser keeps the backslash it saw.
    // Values TYPED in the visual editor do not — the textarea yields a bare "\n" — and writing
    // that out unchanged produced a line with no separator, which the parser then classified as a
    // comment and the next save prefixed with "# ". The user's value silently became a comment.
    //
    // Continued lines are also lined up under the start of the value: the visual editor has no
    // "format" button, so saving is the only moment that layout can be applied.

    const prop = (key: string, value: string) => [{
        type: { value: 'property' },
        key: { value: key },
        value: { value }
    }];

    test('a value typed with a bare newline gets a marker and is aligned under the value', () => {
        const indent = ' '.repeat('multi.key = '.length);

        expect(toCfgFormat(prop('multi.key', 'first\nsecond'))).toBe(
            `multi.key = first \\\n${indent}second\n`
        );
    });

    test('every continued line of a three-line value is aligned', () => {
        const indent = ' '.repeat('org.example.long.key = '.length);

        expect(toCfgFormat(prop('org.example.long.key', 'a\nb\nc'))).toBe(
            `org.example.long.key = a \\\n${indent}b \\\n${indent}c\n`
        );
    });

    test('the result reparses as ONE property, not a property plus a comment', () => {
        const nodes = parseCfgContent(toCfgFormat(prop('multi.key', 'first\nsecond')));

        expect(nodes).toHaveLength(1);
        expect(nodes[0].type.value).toBe('property');
        expect(nodes[0].key.value).toBe('multi.key');
    });

    test('saving twice is stable — no extra backslash, no creeping indentation', () => {
        const once = toCfgFormat(prop('multi.key', 'first\nsecond'));
        const twice = toCfgFormat(parseCfgContent(once));

        expect(twice).toBe(once);
    });

    test('an existing continuation is re-aligned rather than left as it was', () => {
        // Deliberate: the editor owns the layout of what it writes, so a file saved from the visual
        // editor comes out consistently aligned whatever indentation it arrived with. The VALUE is
        // untouched — a properties reader discards a continuation line's leading whitespace.
        const indent = ' '.repeat('multi.key = '.length);

        expect(toCfgFormat(parseCfgContent('multi.key = first \\\n  second\n'))).toBe(
            `multi.key = first \\\n${indent}second\n`
        );
    });

    test('an already-aligned file round-trips byte-identically', () => {
        const indent = ' '.repeat('multi.key = '.length);
        const input = `multi.key = first \\\n${indent}second\n`;

        expect(toCfgFormat(parseCfgContent(input))).toBe(input);
    });

    test('a line ending in an escaped backslash still gets a continuation', () => {
        // "C:\\" is an escaped backslash, an EVEN count, so it is not a continuation marker:
        // one must still be added, or the next line is orphaned.
        const indent = ' '.repeat('win.path = '.length);

        expect(toCfgFormat(prop('win.path', 'C:\\\\\nnext'))).toBe(
            `win.path = C:\\\\ \\\n${indent}next\n`
        );
    });

    test('a trailing newline does not leave a dangling continuation', () => {
        expect(toCfgFormat(prop('trail.key', 'only\n'))).toBe('trail.key = only\n');
    });

    test('the object-tree path gets the same treatment', () => {
        const indent = ' '.repeat('multi = '.length);
        const tree: any = { _order: ['multi'], multi: { isLeaf: true, value: 'first\nsecond' } };

        expect(toCfgFormat(tree)).toBe(`multi = first \\\n${indent}second\n`);
    });

    test('the separator is normalised to " = " whatever the file used', () => {
        expect(toCfgFormat(parseCfgContent('a:1\n'))).toBe('a = 1\n');
        expect(toCfgFormat(parseCfgContent('b=2\n'))).toBe('b = 2\n');
        expect(toCfgFormat(parseCfgContent('c   =   3\n'))).toBe('c = 3\n');
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
