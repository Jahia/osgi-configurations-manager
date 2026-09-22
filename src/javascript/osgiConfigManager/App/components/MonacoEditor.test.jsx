import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import * as monaco from 'monaco-editor'; // resolves to jest-mocks/monaco-editor.js
import { MonacoEditor } from './MonacoEditor';
import { osgiService } from '../api/osgiService';
import { forgetKnownPlaintexts, lookupKnownPlaintext, rememberPlaintext } from '../utils/cryptoTree';

// S42 (G25): with the Monaco stub in place, the editor mounts in jsdom, receives the raw content,
// and its change listener wires back to onChange. Deep Monaco behaviour (highlighting, markers,
// Visual<->Raw preservation in a real browser) is asserted by Cypress (S50).

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));

jest.mock('../api/osgiService');

const mockToast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
jest.mock('../hooks/useToast', () => ({
    useToast: () => mockToast
}));

// Keep moonstone + AppChrome out of the way: this test is about the editor value contract.
jest.mock('@jahia/moonstone', () => new Proxy({}, {
    get: () => (props) => <div {...props} />
}));
jest.mock('./AppChrome', () => ({
    CHROME_TOKENS: {},
    PANEL_ACTIONS_STYLE: {}
}));

/** Mounts the editor on one line of raw content and returns the toolbar buttons plus edit spy. */
const mountLine = (line) => {
    const utils = render(<MonacoEditor value={line} language="properties" filename="secrets.cfg" onChange={jest.fn()} />);
    const editor = monaco.__getLastEditor();
    editor.getModel().getLineContent = () => line;
    editor.executeEdits = jest.fn();
    // The moonstone Button is stubbed as a div carrying the onClick, inside the data-cy wrapper.
    const button = dataCy => utils.container.querySelector(`[data-cy="${dataCy}"] > div`);
    return { editor, encrypt: button('raw-editor-encrypt'), decrypt: button('raw-editor-decrypt') };
};

describe('MonacoEditor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        forgetKnownPlaintexts();
    });

    it('passes the raw content into the editor on mount', () => {
        render(<MonacoEditor value="alpha.key = alpha value" language="properties" onChange={jest.fn()} />);
        expect(monaco.__getLastEditor().getValue()).toBe('alpha.key = alpha value');
    });

    it('propagates editor changes to onChange', () => {
        const onChange = jest.fn();
        render(<MonacoEditor value="alpha.key = alpha value" language="properties" onChange={onChange} />);

        // simulate the user typing new content in the editor
        monaco.__getLastEditor().__fireChange('beta.key = beta value');

        expect(onChange).toHaveBeenCalledWith('beta.key = beta value');
    });

    describe('Encrypt / Decrypt buttons', () => {
        it('remembers the pair when encrypting a line, so the value stays readable before the save', async () => {
            osgiService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(fresh)' });
            const { editor, encrypt } = mountLine('token = clear-value');

            fireEvent.click(encrypt);

            await waitFor(() => expect(editor.executeEdits).toHaveBeenCalledTimes(1));
            expect(osgiService.encrypt).toHaveBeenCalledWith('clear-value');
            expect(editor.executeEdits.mock.calls[0][1][0].text).toBe('ENC(fresh)');
            expect(lookupKnownPlaintext('ENC(fresh)')).toBe('clear-value');
        });

        it('decrypts a ciphertext this page produced without asking the server', async () => {
            // Not in the saved file yet: the file-bound server decryption would refuse it.
            rememberPlaintext('ENC(fresh)', 'clear-value');
            const { editor, decrypt } = mountLine('token = ENC(fresh)');

            fireEvent.click(decrypt);

            await waitFor(() => expect(editor.executeEdits).toHaveBeenCalledTimes(1));
            expect(osgiService.decrypt).not.toHaveBeenCalled();
            expect(editor.executeEdits.mock.calls[0][1][0].text).toBe('clear-value');
            expect(mockToast.error).not.toHaveBeenCalled();
        });

        it('asks the server for a saved ciphertext, bound to the file, and remembers the answer', async () => {
            osgiService.decrypt.mockResolvedValue({ decryptedValue: 'from-disk' });
            const { editor, decrypt } = mountLine('token = ENC(disk)');

            fireEvent.click(decrypt);

            await waitFor(() => expect(editor.executeEdits).toHaveBeenCalledTimes(1));
            expect(osgiService.decrypt).toHaveBeenCalledWith('ENC(disk)', 'secrets.cfg');
            expect(editor.executeEdits.mock.calls[0][1][0].text).toBe('from-disk');
            expect(lookupKnownPlaintext('ENC(disk)')).toBe('from-disk');
        });

        it('says so when the server refuses the value instead of doing nothing', async () => {
            osgiService.decrypt.mockRejectedValue(new Error('Encrypted value does not belong to secrets.cfg'));
            const { editor, decrypt } = mountLine('token = ENC(elsewhere)');

            fireEvent.click(decrypt);

            await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('notification.decryptRefused'));
            expect(editor.executeEdits).not.toHaveBeenCalled();
        });

        it('says so when the server hands the value back undecrypted', async () => {
            // Encrypted with another instance's secret: returned unchanged rather than failing.
            osgiService.decrypt.mockResolvedValue({ decryptedValue: 'ENC(foreign)' });
            const { editor, decrypt } = mountLine('token = ENC(foreign)');

            fireEvent.click(decrypt);

            await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('notification.decryptRefused'));
            expect(editor.executeEdits).not.toHaveBeenCalled();
            expect(lookupKnownPlaintext('ENC(foreign)')).toBeUndefined();
        });

        it('warns when the current line holds no ENC(...) value', async () => {
            const { editor, decrypt } = mountLine('token = clear-value');

            fireEvent.click(decrypt);

            await waitFor(() => expect(mockToast.warning).toHaveBeenCalledWith('notification.decryptNoValue'));
            expect(osgiService.decrypt).not.toHaveBeenCalled();
            expect(editor.executeEdits).not.toHaveBeenCalled();
        });
    });
});
