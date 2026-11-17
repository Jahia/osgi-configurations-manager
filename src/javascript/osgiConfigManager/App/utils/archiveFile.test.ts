import { arrayBufferToBase64, isArchiveFile, isExportable } from './archiveFile';

describe('archiveFile', () => {
    it('recognises an export archive by its extension, in any case', () => {
        expect(isArchiveFile('export.ocmx')).toBe(true);
        expect(isArchiveFile('EXPORT.OCMX')).toBe(true);
        expect(isArchiveFile('org.example.cfg')).toBe(false);
    });

    // The server refuses it: it holds the secret every other value is encrypted with.
    it('never offers the manager\'s own configuration for export, in any spelling', () => {
        expect(isExportable('org.jahia.modules.osgiconfigmanager.cfg')).toBe(false);
        expect(isExportable('ORG.JAHIA.MODULES.OSGICONFIGMANAGER.yml.disabled')).toBe(false);
        expect(isExportable('org.jahia.modules.osgiconfigmanager.probe.cfg')).toBe(true);
        expect(isExportable('org.example.cfg')).toBe(true);
    });

    // One String.fromCharCode(...bytes) call on a large file overflowed the stack.
    it('encodes a large binary file as base64 without overflowing', () => {
        const bytes = new Uint8Array(300000).map((_, i) => i % 256);
        const encoded = arrayBufferToBase64(bytes.buffer);
        const decoded = Uint8Array.from(window.atob(encoded), c => c.charCodeAt(0));
        expect(decoded).toEqual(bytes);
    });
});
