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
 */

type CryptoErrorHandler = (error: unknown) => void;

const isEncryptableLeaf = (node: any): boolean =>
    Boolean(node) && node.isLeaf === true && node.encrypted === true && typeof node.value === 'string';

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

    if (isEncryptableLeaf(node) && node.value.startsWith('ENC(')) {
        try {
            const decrypted = await osgiService.decrypt(node.value, filename);
            node.value = decrypted.decryptedValue || node.value;
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
 * Leaves that are already encrypted (value starts with {@code ENC(}) are left untouched.
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
        if (!next.value.startsWith('ENC(')) {
            try {
                const encrypted = await osgiService.encrypt(next.value);
                next.value = encrypted.encryptedValue || next.value;
            } catch (error) {
                onError?.(error);
            }
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
