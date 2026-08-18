import { decryptTree, encryptTree } from './cryptoTree';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');

const mockedService = osgiService as jest.Mocked<typeof osgiService>;

describe('cryptoTree', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('decryptTree', () => {
        it('decrypts ENC(...) leaf values in place, binding to the filename', async () => {
            mockedService.decrypt.mockResolvedValue({ decryptedValue: 'plain' } as any);
            const tree = {
                password: { isLeaf: true, encrypted: true, value: 'ENC(abc)' },
                other: { isLeaf: true, encrypted: false, value: 'visible' }
            };

            await decryptTree(tree, 'secrets.cfg');

            expect(mockedService.decrypt).toHaveBeenCalledWith('ENC(abc)', 'secrets.cfg');
            expect(tree.password.value).toBe('plain');
            expect(tree.other.value).toBe('visible');
        });

        it('does not call decrypt for non-ENC encrypted leaves (already cleartext)', async () => {
            const tree = { p: { isLeaf: true, encrypted: true, value: 'alreadyPlain' } };

            await decryptTree(tree, 'f.cfg');

            expect(mockedService.decrypt).not.toHaveBeenCalled();
            expect(tree.p.value).toBe('alreadyPlain');
        });

        it('recurses through arrays and nested objects, skipping _order', async () => {
            mockedService.decrypt.mockResolvedValue({ decryptedValue: 'D' } as any);
            const tree = {
                _order: ['group'],
                group: [{ isLeaf: true, encrypted: true, value: 'ENC(x)' }]
            };

            await decryptTree(tree, 'f.cfg');

            expect(mockedService.decrypt).toHaveBeenCalledTimes(1);
            expect(tree.group[0].value).toBe('D');
        });

        it('invokes onError and leaves the value when decryption fails', async () => {
            mockedService.decrypt.mockRejectedValue(new Error('boom'));
            const onError = jest.fn();
            const tree = { p: { isLeaf: true, encrypted: true, value: 'ENC(x)' } };

            await decryptTree(tree, 'f.cfg', onError);

            expect(onError).toHaveBeenCalledTimes(1);
            expect(tree.p.value).toBe('ENC(x)');
        });
    });

    describe('encryptTree', () => {
        it('returns a new tree with encrypted leaves wrapped, without mutating the input', async () => {
            mockedService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(zzz)' } as any);
            const input = { p: { isLeaf: true, encrypted: true, value: 'secret' } };

            const result = await encryptTree(input);

            expect(mockedService.encrypt).toHaveBeenCalledWith('secret');
            expect(result.p.value).toBe('ENC(zzz)');
            // Original input is untouched (immutability).
            expect(input.p.value).toBe('secret');
        });

        it('does not re-encrypt values already in ENC(...) form', async () => {
            const input = { p: { isLeaf: true, encrypted: true, value: 'ENC(already)' } };

            const result = await encryptTree(input);

            expect(mockedService.encrypt).not.toHaveBeenCalled();
            expect(result.p.value).toBe('ENC(already)');
        });

        it('leaves non-encrypted leaves alone and recurses into containers', async () => {
            mockedService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(s)' } as any);
            const input = {
                plain: { isLeaf: true, encrypted: false, value: 'keepme' },
                nested: { secret: { isLeaf: true, encrypted: true, value: 'top' } }
            };

            const result = await encryptTree(input);

            expect(result.plain.value).toBe('keepme');
            expect(result.nested.secret.value).toBe('ENC(s)');
        });

        it('invokes onError and keeps plaintext when encryption fails', async () => {
            mockedService.encrypt.mockRejectedValue(new Error('no key'));
            const onError = jest.fn();
            const input = { p: { isLeaf: true, encrypted: true, value: 'secret' } };

            const result = await encryptTree(input, onError);

            expect(onError).toHaveBeenCalledTimes(1);
            expect(result.p.value).toBe('secret');
        });
    });
});
