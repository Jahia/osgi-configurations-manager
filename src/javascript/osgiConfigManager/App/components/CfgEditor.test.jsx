import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
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

    describe('keyboard reorder handle', () => {
        const threeRows = [
            {type: 'property', key: 'first.key', value: '1'},
            {type: 'property', key: 'second.key', value: '2'},
            {type: 'property', key: 'third.key', value: '3'}
        ];

        const renderRows = handleReorder => render(
            <CfgEditor
                {...baseProps}
                handleReorder={handleReorder}
                visualFormattingControlsEnabled={false}
                showComments={false}
                showEmptyLines={false}
                entries={threeRows}
            />
        );

        it('exposes a focusable handle per row', () => {
            const {container} = renderRows(jest.fn());

            threeRows.forEach((_, index) => {
                const handle = container.querySelector(`[data-cy="cfg-reorder-${index}"]`);
                expect(handle).toBeInTheDocument();
                // A button, not a bare icon — that is what makes it reachable by keyboard.
                expect(handle.tagName).toBe('BUTTON');
            });
        });

        it('moves a row up on Arrow Up and down on Arrow Down', () => {
            const handleReorder = jest.fn();
            const {container} = renderRows(handleReorder);

            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-1"]'), {key: 'ArrowUp'});
            expect(handleReorder).toHaveBeenCalledWith(1, 0);

            handleReorder.mockClear();
            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-1"]'), {key: 'ArrowDown'});
            expect(handleReorder).toHaveBeenCalledWith(1, 2);
        });

        it('does not move past either end of the list', () => {
            const handleReorder = jest.fn();
            const {container} = renderRows(handleReorder);

            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-0"]'), {key: 'ArrowUp'});
            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-2"]'), {key: 'ArrowDown'});

            expect(handleReorder).not.toHaveBeenCalled();
        });

        it('ignores other keys', () => {
            const handleReorder = jest.fn();
            const {container} = renderRows(handleReorder);

            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-1"]'), {key: 'Enter'});
            fireEvent.keyDown(container.querySelector('[data-cy="cfg-reorder-1"]'), {key: 'ArrowLeft'});

            expect(handleReorder).not.toHaveBeenCalled();
        });
    });
});
