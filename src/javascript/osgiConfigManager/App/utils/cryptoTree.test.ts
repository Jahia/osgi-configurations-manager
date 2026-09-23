import { countUndecryptedLeaves, decryptTree, encryptTree, forgetKnownPlaintexts, lookupKnownPlaintext, rememberPlaintext } from './cryptoTree';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');

const mockedService = osgiService as jest.Mocked<typeof osgiService>;

describe('cryptoTree', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        forgetKnownPlaintexts();
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

        it('keeps the ciphertext a leaf was decrypted from, next to the plaintext', async () => {
            mockedService.decrypt.mockResolvedValue({ decryptedValue: 'plain' } as any);
            const tree = { p: { isLeaf: true, encrypted: true, value: 'ENC(abc)' } };

            await decryptTree(tree, 'f.cfg');

            expect(tree.p).toMatchObject({ value: 'plain', cipherValue: 'ENC(abc)', decryptedValue: 'plain' });
            expect(lookupKnownPlaintext('ENC(abc)')).toBe('plain');
        });

        it('does not remember a value the server handed back undecrypted', async () => {
            // The server returns an undecryptable envelope unchanged rather than failing the page.
            mockedService.decrypt.mockResolvedValue({ decryptedValue: 'ENC(foreign)' } as any);
            const tree = { p: { isLeaf: true, encrypted: true, value: 'ENC(foreign)' } };

            await decryptTree(tree, 'f.cfg');

            expect(tree.p.value).toBe('ENC(foreign)');
            expect(tree.p).not.toHaveProperty('cipherValue');
            expect(lookupKnownPlaintext('ENC(foreign)')).toBeUndefined();
        });

        it('uses a remembered pair instead of asking the server', async () => {
            // A ciphertext this page produced itself is not in the file yet, so the file-bound server
            // decryption would refuse it; the page must not need to ask.
            rememberPlaintext('ENC(fresh)', 'typed-a-moment-ago');
            const tree = { p: { isLeaf: true, encrypted: true, value: 'ENC(fresh)' } };

            await decryptTree(tree, 'f.cfg');

            expect(mockedService.decrypt).not.toHaveBeenCalled();
            expect(tree.p).toMatchObject({ value: 'typed-a-moment-ago', cipherValue: 'ENC(fresh)' });
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

        it('writes the original ciphertext back while the plaintext is unchanged', async () => {
            // Encryption uses a random IV: asking the server again would produce a ciphertext that
            // is not on disk, which the file-bound decryption then refuses.
            const input = { p: { isLeaf: true, encrypted: true, value: 'plain', cipherValue: 'ENC(disk)', decryptedValue: 'plain' } };

            const result = await encryptTree(input);

            expect(mockedService.encrypt).not.toHaveBeenCalled();
            expect(result.p.value).toBe('ENC(disk)');
        });

        it('encrypts again once the plaintext was edited, and remembers the new pair', async () => {
            mockedService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(new)' } as any);
            const input = { p: { isLeaf: true, encrypted: true, value: 'edited', cipherValue: 'ENC(disk)', decryptedValue: 'plain' } };

            const result = await encryptTree(input);

            expect(mockedService.encrypt).toHaveBeenCalledWith('edited');
            expect(result.p.value).toBe('ENC(new)');
            expect(lookupKnownPlaintext('ENC(new)')).toBe('edited');
        });

        it('round-trips a value through raw mode and back without the server decrypting it', async () => {
            mockedService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(fresh)' } as any);
            const visual = { p: { isLeaf: true, encrypted: true, value: 'typed' } };

            const raw = await encryptTree(visual);
            const parsedBack = { p: { isLeaf: true, encrypted: true, value: raw.p.value } };
            await decryptTree(parsedBack, 'f.cfg');

            expect(mockedService.decrypt).not.toHaveBeenCalled();
            expect(parsedBack.p.value).toBe('typed');
        });
    });

    describe('rememberPlaintext', () => {
        it('ignores a pair whose two sides are the same string', () => {
            rememberPlaintext('same', 'same');

            expect(lookupKnownPlaintext('same')).toBeUndefined();
        });
    });

    describe('countUndecryptedLeaves', () => {
        it('counts the encrypted leaves still wrapped after decryption, wherever they sit', () => {
            const tree = {
                _order: ['a', 'group'],
                a: { isLeaf: true, encrypted: true, value: 'ENC(unreadable)' },
                plain: { isLeaf: true, encrypted: false, value: 'ENC(not flagged, not counted)' },
                group: [
                    { isLeaf: true, encrypted: true, value: 'decrypted' },
                    { nested: { isLeaf: true, encrypted: true, value: 'ENC(other)' } }
                ]
            };

            expect(countUndecryptedLeaves(tree)).toBe(2);
        });

        it('returns 0 for an empty or fully decrypted tree', () => {
            expect(countUndecryptedLeaves({})).toBe(0);
            expect(countUndecryptedLeaves([{ isLeaf: true, encrypted: true, value: 'plain' }])).toBe(0);
        });
    });
});
