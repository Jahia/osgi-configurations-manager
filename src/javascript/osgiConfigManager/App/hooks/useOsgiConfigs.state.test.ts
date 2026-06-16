import { detectConfigStateFromRawContent } from './useOsgiConfigs';

describe('detectConfigStateFromRawContent', () => {
    it('returns MODULE when a "# do not edit" header is present', () => {
        expect(detectConfigStateFromRawContent('# DO NOT EDIT\nkey = value')).toBe('MODULE');
    });

    it('returns MODULE_DEFAULT when a "# default configuration" header is present', () => {
        expect(detectConfigStateFromRawContent('# default configuration, can be edited\nkey = value'))
            .toBe('MODULE_DEFAULT');
    });

    it('is case-insensitive and tolerant of leading whitespace', () => {
        expect(detectConfigStateFromRawContent('   # Default Configuration\n')).toBe('MODULE_DEFAULT');
    });

    it('prefers MODULE when the do-not-edit header appears first', () => {
        expect(detectConfigStateFromRawContent('# do not edit\n# default configuration\n')).toBe('MODULE');
    });

    it('returns USER for ordinary content and for empty/blank input', () => {
        expect(detectConfigStateFromRawContent('key = value\n# a normal comment')).toBe('USER');
        expect(detectConfigStateFromRawContent('')).toBe('USER');
        expect(detectConfigStateFromRawContent(undefined as unknown as string)).toBe('USER');
    });

    it('handles CRLF line endings', () => {
        expect(detectConfigStateFromRawContent('# do not edit\r\nkey = value')).toBe('MODULE');
    });
});
