import React from 'react';
import {render, screen} from '@testing-library/react';
import {CfgEditor} from './CfgEditor';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

jest.mock('./CfgMetatypePropertyDialog', () => ({
    CfgMetatypeInfoTooltip: () => null,
    CfgMetatypePropertyDialog: () => null
}));

describe('CfgEditor', () => {
    const baseProps = {
        handlePropUpdate: jest.fn(),
        handleDeleteProperty: jest.fn(),
        handleAddCfgEntry: jest.fn(),
        handleReorder: jest.fn(),
        setModalConfig: jest.fn(),
        handleToggleEncryption: jest.fn(),
        handleToggleComments: jest.fn(),
        setShowComments: jest.fn(),
        handleToggleEmptyLines: jest.fn(),
        setShowEmptyLines: jest.fn(),
        metatypeDefinition: null
    };

    it('hides comment and empty-line controls and rows when visual formatting controls are disabled', () => {
        const {container} = render(
            <CfgEditor
                {...baseProps}
                visualFormattingControlsEnabled={false}
                showComments={false}
                showEmptyLines={false}
                entries={[
                    {type: 'comment', value: '# hidden comment'},
                    {type: 'empty', value: ''},
                    {type: 'property', key: 'alpha.key', value: 'alpha value'}
                ]}
            />
        );

        expect(container.querySelector('[data-cy="cfg-add-comment"]')).not.toBeInTheDocument();
        expect(container.querySelector('[data-cy="cfg-add-empty-line"]')).not.toBeInTheDocument();
        expect(container.querySelector('[data-cy="cfg-toggle-comments"]')).not.toBeInTheDocument();
        expect(container.querySelector('[data-cy="cfg-toggle-empty-lines"]')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('hidden comment')).not.toBeInTheDocument();
        expect(screen.queryByText('editor.emptyLine')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('alpha.key')).toBeInTheDocument();
        expect(screen.getByDisplayValue('alpha value')).toBeInTheDocument();
    });

    it('renders comment controls and the comment content when visual formatting controls are enabled', () => {
        const {container} = render(
            <CfgEditor
                {...baseProps}
                visualFormattingControlsEnabled={true}
                showComments={true}
                showEmptyLines={true}
                entries={[
                    {type: 'comment', value: '# visible comment'},
                    {type: 'property', key: 'alpha.key', value: 'alpha value'}
                ]}
            />
        );

        expect(container.querySelector('[data-cy="cfg-add-comment"]')).toBeInTheDocument();
        expect(container.querySelector('[data-cy="cfg-toggle-comments"]')).toBeInTheDocument();
        expect(screen.getByDisplayValue('visible comment')).toBeInTheDocument();
    });
});
