import { configurationStem } from './configIdentity';
import { MANAGER_PID } from './managerSettings';

/** The extension of the manager's export archives. */
export const ARCHIVE_EXTENSION = '.ocmx';

/** Whether a picked file is an export archive rather than a configuration file. */
export const isArchiveFile = (filename: string): boolean => filename.toLowerCase().endsWith(ARCHIVE_EXTENSION);

/** The server refuses to export the manager's own configuration: it holds the encryption secret. */
export const isExportable = (filename: string): boolean => configurationStem(filename) !== MANAGER_PID;

/** The minimum length the server requires of an archive password. */
export const MIN_ARCHIVE_PASSWORD_LENGTH = 12;

/** A binary file as base64, in chunks: one String.fromCharCode call per byte overflows the stack. */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return window.btoa(binary);
};

/** Reads a picked file as base64. */
export const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(arrayBufferToBase64(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read'));
    reader.readAsArrayBuffer(file);
});

/** Hands the browser a base64 payload as a file to save. */
export const downloadBase64 = (base64: string, fileName: string): void => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // After the click has been handled: revoking at once can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
