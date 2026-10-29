import React from 'react';
import {render, screen} from '@testing-library/react';
import {CfgEditor} from './CfgEditor';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: (key, options) => (options?.key ? `${key}:${options.key}` : key)})
}));

jest.mock('./CfgMetatypePropertyDialog', () => ({
    CfgMetatypeInfoTooltip: () => null,
    CfgMetatypePropertyDialog: () => null
}));

const noop = jest.fn();

describe('CfgEditor encryption checkbox', () => {
    // A title on the surrounding cell does not name the input: screen readers said only "checkbox".
    it('names each encryption checkbox after its property', () => {
        render(
            <CfgEditor
                entries={[
                    {type: 'property', key: 'db.url', value: 'jdbc:x'},
                    {type: 'property', key: '', value: 'orphan'}
                ]}
                handlePropUpdate={noop}
                handleDeleteProperty={noop}
                handleAddCfgEntry={noop}
                handleReorder={noop}
                setModalConfig={noop}
                handleToggleEncryption={noop}
                metatypeDefinition={null}
            />
        );

        expect(screen.getByRole('checkbox', {name: 'editor.encryptValueOf:db.url'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'editor.encryptValueOf:#2'})).toBeInTheDocument();
    });
});
