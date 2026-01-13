
import { parseCfgContent } from './configUtils';

describe('configUtils parsing', () => {
    test('parses simple key-value pairs', () => {
        const content = `
key1 = value1
key2: value2
        `.trim();
        const result = parseCfgContent(content);
        expect(result).toHaveLength(2);
        expect(result[0].key.value).toBe('key1');
        expect(result[0].value.value).toBe('value1');
        expect(result[1].key.value).toBe('key2');
        expect(result[1].value.value).toBe('value2');
    });

    test('parses comments', () => {
        const content = `
# This is a comment
! Another comment
key = value
        `.trim();
        const result = parseCfgContent(content);
        // Expecting 3 items: comment, comment, property
        expect(result).toHaveLength(3);
        expect(result[0].type.value).toBe('comment');
        expect(result[1].type.value).toBe('comment');
        expect(result[2].key.value).toBe('key');
    });

    test('handles line continuation with backslash', () => {
        const content = 'multiline.key = line1 \\\n    line2';
        const result = parseCfgContent(content);

        // Should be parsed as ONE property
        expect(result).toHaveLength(1);
        expect(result[0].key.value).toBe('multiline.key');
        // User wants to preserve the backslash and newline in the value
        expect(result[0].value.value).toBe('line1 \\\nline2');
    });

    test('handles multiple line continuations', () => {
        const content = 'long.value = part1 \\\n    part2 \\\n    part3';
        const result = parseCfgContent(content);
        expect(result).toHaveLength(1);
        expect(result[0].value.value).toBe('part1 \\\npart2 \\\npart3');
    });
});
