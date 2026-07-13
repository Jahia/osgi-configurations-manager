import React from 'react';
import { render } from '@testing-library/react';
import * as monaco from 'monaco-editor'; // resolves to jest-mocks/monaco-editor.js
import { MonacoEditor } from './MonacoEditor';

// S42 (G25): with the Monaco stub in place, the editor mounts in jsdom, receives the raw content,
// and its change listener wires back to onChange. Deep Monaco behaviour (highlighting, markers,
// Visual<->Raw preservation in a real browser) is asserted by Cypress (S50).

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));

// Keep moonstone + AppChrome out of the way: this test is about the editor value contract.
jest.mock('@jahia/moonstone', () => new Proxy({}, {
    get: () => (props) => <div {...props} />
}));
jest.mock('./AppChrome', () => ({
    CHROME_TOKENS: {},
    PANEL_ACTIONS_STYLE: {}
}));

describe('MonacoEditor', () => {
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
});
