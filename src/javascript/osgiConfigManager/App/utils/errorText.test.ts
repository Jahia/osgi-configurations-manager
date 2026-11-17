import { errorText } from './errorText';

describe('errorText', () => {
    it('drops the final full stop, which the sentence around it supplies', () => {
        expect(errorText(new Error('Access denied.'))).toBe('Access denied');
        expect(errorText(new Error('  Disk full. \n'))).toBe('Disk full');
    });

    it('keeps a message without a full stop and accepts a plain string', () => {
        expect(errorText(new Error('Timeout'))).toBe('Timeout');
        expect(errorText('Refused')).toBe('Refused');
    });

    it('is never empty', () => {
        expect(errorText(new Error(''))).toBe('unknown error');
        expect(errorText(undefined)).toBe('unknown error');
    });
});
