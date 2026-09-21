import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {CfgEditor} from './CfgEditor';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

// The picker is replaced by two buttons that hand back a Password attribute and a String one, so
// the test drives insertOrFocusProperty exactly the way the real dialog does.
jest.mock('./CfgMetatypePropertyDialog', () => ({
    CfgMetatypeInfoTooltip: () => null,
    CfgMetatypePropertyDialog: ({onSelectMetatypeProperty}) => (
        <div>
            <button type="button" data-testid="pick-password"
                onClick={() => onSelectMetatypeProperty({id: 'jira.token', type: 'password', defaultValues: []})}>pick password</button>
            <button type="button" data-testid="pick-string"
                onClick={() => onSelectMetatypeProperty({id: 'jira.user', type: 'string', defaultValues: ['bot']})}>pick string</button>
        </div>
    )
}));

describe('CfgEditor - Password attributes are encrypted by default', () => {
    const baseProps = {
        entries: [],
        handlePropUpdate: jest.fn(),
        handleDeleteProperty: jest.fn(),
        handleReorder: jest.fn(),
        setModalConfig: jest.fn(),
        handleToggleEncryption: jest.fn(),
        handleToggleComments: jest.fn(),
        setShowComments: jest.fn(),
        handleToggleEmptyLines: jest.fn(),
        setShowEmptyLines: jest.fn(),
        visualFormattingControlsEnabled: false,
        showComments: false,
        showEmptyLines: false,
        metatypeDefinition: {pid: 'org.acme.jira', properties: []}
    };

    it('inserts a Password attribute with the encrypted flag set', () => {
        const handleAddCfgEntry = jest.fn();
        render(<CfgEditor {...baseProps} handleAddCfgEntry={handleAddCfgEntry}/>);

        fireEvent.click(screen.getByTestId('pick-password'));

        expect(handleAddCfgEntry).toHaveBeenCalledTimes(1);
        const [entry] = handleAddCfgEntry.mock.calls[0];
        expect(entry).toMatchObject({type: 'property', key: 'jira.token', encrypted: true});
    });

    it('inserts a String attribute unencrypted, with its default value', () => {
        const handleAddCfgEntry = jest.fn();
        render(<CfgEditor {...baseProps} handleAddCfgEntry={handleAddCfgEntry}/>);

        fireEvent.click(screen.getByTestId('pick-string'));

        const [entry] = handleAddCfgEntry.mock.calls[0];
        expect(entry).toMatchObject({type: 'property', key: 'jira.user', value: 'bot', encrypted: false});
    });
});
