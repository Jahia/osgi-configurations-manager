import { osgiService } from '../api/osgiService';

/**
 * Shared traversal for the "decrypt-in-memory" property model.
 *
 * The visual editor holds decrypted plaintext in the property tree while the raw/on-disk content
 * keeps the {@code ENC(...)} ciphertext. These two helpers are the single source of truth for
 * walking that tree — previously the same recursion was copy-pasted (with subtle divergence) in
 * several places inside {@code useOsgiConfigs}.
 *
 * - {@link decryptTree} mutates leaf values in place (callers immediately re-baseline from the same
 *   object, so an in-place walk matches the existing contract).
 * - {@link encryptTree} returns a NEW tree, never mutating its input (immutability for the visual
 *   state that stays on screen).
 *
 * <h3>Why the ciphertext is remembered</h3>
 *
 * Decryption is file-bound on the server: it only decrypts a ciphertext that is present in the
 * named file, so the action cannot be used as an oracle. Encryption uses a random IV, so encrypting
 * the same plaintext twice yields two different ciphertexts. Put together, re-encrypting an
 * unchanged value when the editor switches to raw mode produced a ciphertext that is NOT on disk,
 * and switching back to visual mode could not decrypt it: the eye button then showed the stored
 * {@code ENC(...)} instead of the secret.
 *
 * So a decrypted leaf keeps the ciphertext it came from ({@code cipherValue}) and the plaintext it
 * decrypted to ({@code decryptedValue}). While the plaintext is unchanged, {@link encryptTree}
 * writes that same ciphertext back instead of asking the server for a new one. Every pair the
 * session has seen is also remembered here, so a value encrypted a moment ago (added in visual mode
 * and not saved yet, hence absent from the file) is still readable when the editor comes back to
 * visual mode. The cache holds plaintext, like the visual state itself, and lives only as long as
 * the page.
 */

type CryptoErrorHandler = (error: unknown) => void;

const ENC_PREFIX = 'ENC(';

/** ciphertext -> plaintext, for every pair this page has encrypted or decrypted. */
const knownPlaintexts = new Map<string, string>();

const isEncryptableLeaf = (node: any): boolean =>
    Boolean(node) && node.isLeaf === true && node.encrypted === true && typeof node.value === 'string';

/** Plaintext this page already knows for {@code ciphertext}, or undefined. */
export const lookupKnownPlaintext = (ciphertext: string): string | undefined => knownPlaintexts.get(ciphertext);

/** Records a ciphertext/plaintext pair; the two must differ, an unchanged value is not a pair. */
export const rememberPlaintext = (ciphertext: string, plaintext: string): void => {
    if (typeof ciphertext === 'string' && typeof plaintext === 'string' && ciphertext !== plaintext) {
        knownPlaintexts.set(ciphertext, plaintext);
    }
};

/** Test seam: forgets every remembered pair. */
export const forgetKnownPlaintexts = (): void => {
    knownPlaintexts.clear();
};

const bindLeafToCiphertext = (node: any, ciphertext: string, plaintext: string): void => {
    node.value = plaintext;
    node.cipherValue = ciphertext;
    node.decryptedValue = plaintext;
};

/**
 * Recursively decrypts {@code ENC(...)} leaf values in place. {@code filename} binds decryption to
 * the authorized file so the backend cannot be used as a generic decryption oracle.
 */
export const decryptTree = async (node: any, filename: string, onError?: CryptoErrorHandler): Promise<void> => {
    if (Array.isArray(node)) {
        await Promise.all(node.map(item => decryptTree(item, filename, onError)));
        return;
    }

    if (!node || typeof node !== 'object') {
        return;
    }

    if (isEncryptableLeaf(node) && node.value.startsWith(ENC_PREFIX)) {
        const ciphertext: string = node.value;

        const known = lookupKnownPlaintext(ciphertext);
        if (known !== undefined) {
            bindLeafToCiphertext(node, ciphertext, known);
            return;
        }

        try {
            const decrypted = await osgiService.decrypt(ciphertext, filename);
            const plaintext = decrypted.decryptedValue || ciphertext;
            if (plaintext !== ciphertext) {
                // The server hands an undecryptable value back unchanged; that is not a pair.
                rememberPlaintext(ciphertext, plaintext);
                bindLeafToCiphertext(node, ciphertext, plaintext);
            }
        } catch (error) {
            onError?.(error);
        }
        return;
    }

    await Promise.all(
        Object.entries(node)
            .filter(([key]) => key !== '_order')
            .map(([, value]) => decryptTree(value, filename, onError))
    );
};

/**
 * Returns a deep copy of {@code node} with encrypted leaf values wrapped in {@code ENC(...)}.
 * Leaves that are already encrypted (value starts with {@code ENC(}) are left untouched, and a leaf
 * whose plaintext is the one it was decrypted from gets its original ciphertext back.
 */
export const encryptTree = async (node: any, onError?: CryptoErrorHandler): Promise<any> => {
    if (Array.isArray(node)) {
        return Promise.all(node.map(item => encryptTree(item, onError)));
    }

    if (!node || typeof node !== 'object') {
        return node;
    }

    const next = { ...node };

    if (isEncryptableLeaf(next)) {
        if (next.value.startsWith(ENC_PREFIX)) {
            return next;
        }

        if (typeof next.cipherValue === 'string' && next.value === next.decryptedValue) {
            next.value = next.cipherValue;
            return next;
        }

        try {
            const plaintext: string = next.value;
            const encrypted = await osgiService.encrypt(plaintext);
            const ciphertext = encrypted.encryptedValue || plaintext;
            rememberPlaintext(ciphertext, plaintext);
            next.value = ciphertext;
        } catch (error) {
            onError?.(error);
        }
        return next;
    }

    await Promise.all(
        Object.keys(next).map(async key => {
            if (key === '_order' || typeof next[key] !== 'object' || next[key] === null) {
                return;
            }
            next[key] = await encryptTree(next[key], onError);
        })
    );

    return next;
};
