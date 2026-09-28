import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {CfgEditor, matchesCfgFilter} from './CfgEditor';

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
    describe('drag zone', () => {
        const entries = [
            {type: 'property', key: 'alpha.key', value: 'alpha value'},
            {type: 'property', key: 'beta.key', value: 'beta value'}
        ];

        it('makes a row draggable only while the pointer is down on its handle cell, so text can be selected', () => {
            const {container} = render(<CfgEditor {...baseProps} entries={entries} visualFormattingControlsEnabled showComments showEmptyLines/>);
            const row = container.querySelector('[data-cy="cfg-row-0"]');
            expect(row.getAttribute('draggable')).toBe('false');

            // Pressing in the value field (a text selection) does not arm the row.
            fireEvent.mouseDown(screen.getByDisplayValue('alpha value'));
            expect(row.getAttribute('draggable')).toBe('false');

            fireEvent.mouseDown(container.querySelector('[data-cy="cfg-drag-zone-0"]'));
            expect(row.getAttribute('draggable')).toBe('true');
            expect(container.querySelector('[data-cy="cfg-row-1"]').getAttribute('draggable')).toBe('false');

            fireEvent.mouseUp(window);
            expect(row.getAttribute('draggable')).toBe('false');
        });

        it('reorders on a drop that started from the handle, and ignores a drag started elsewhere', () => {
            const handleReorder = jest.fn();
            const {container} = render(<CfgEditor {...baseProps} handleReorder={handleReorder} entries={entries} visualFormattingControlsEnabled showComments showEmptyLines/>);
            const dataTransfer = {effectAllowed: '', dropEffect: ''};
            const row0 = container.querySelector('[data-cy="cfg-row-0"]');
            const row1 = container.querySelector('[data-cy="cfg-row-1"]');

            fireEvent.dragStart(row0, {dataTransfer});
            fireEvent.drop(row1, {dataTransfer});
            expect(handleReorder).not.toHaveBeenCalled();

            fireEvent.mouseDown(container.querySelector('[data-cy="cfg-drag-zone-0"]'));
            fireEvent.dragStart(row0, {dataTransfer});
            fireEvent.drop(row1, {dataTransfer});
            expect(handleReorder).toHaveBeenCalledWith(0, 1);
        });
    });

    describe('filter', () => {
        const entries = [
            {type: 'comment', value: '# jira settings'},
            {type: 'property', key: 'jira.url', value: 'https://jira.example.org'},
            {type: 'property', key: 'jira.token', value: {value: 'secret-jira', encrypted: true}},
            {type: 'empty', value: ''},
            {type: 'property', key: 'slack.url', value: 'https://slack.com/api'}
        ];

        it('keeps the properties whose name or value contains the text, case-insensitively, and nothing else', () => {
            const {container} = render(<CfgEditor {...baseProps} entries={entries} visualFormattingControlsEnabled showComments showEmptyLines/>);
            const input = container.querySelector('[data-cy="cfg-filter"] input');

            fireEvent.change(input, {target: {value: 'JIRA'}});
            expect(screen.getByDisplayValue('jira.url')).toBeInTheDocument();
            expect(screen.getByDisplayValue('jira.token')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('slack.url')).not.toBeInTheDocument();
            expect(screen.queryByDisplayValue('jira settings')).not.toBeInTheDocument();
            expect(container.querySelector('[data-cy="cfg-filter-count"]')).toBeInTheDocument();

            // By value.
            fireEvent.change(input, {target: {value: 'slack.com'}});
            expect(screen.getByDisplayValue('slack.url')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('jira.url')).not.toBeInTheDocument();

            // Cleared: every row is back.
            fireEvent.change(input, {target: {value: ''}});
            expect(screen.getByDisplayValue('jira settings')).toBeInTheDocument();
            expect(container.querySelector('[data-cy="cfg-filter-count"]')).not.toBeInTheDocument();
        });

        it('turns reordering off while filtering', () => {
            const {container} = render(<CfgEditor {...baseProps} entries={entries} visualFormattingControlsEnabled showComments showEmptyLines/>);
            fireEvent.change(container.querySelector('[data-cy="cfg-filter"] input'), {target: {value: 'jira'}});
            fireEvent.mouseDown(container.querySelector('[data-cy="cfg-drag-zone-1"]'));
            expect(container.querySelector('[data-cy="cfg-row-1"]').getAttribute('draggable')).toBe('false');
        });

        it('never searches an encrypted value', () => {
            expect(matchesCfgFilter(entries[2], 'secret')).toBe(false);
            expect(matchesCfgFilter(entries[2], 'token')).toBe(true);
            expect(matchesCfgFilter(entries[0], 'jira')).toBe(false);
            expect(matchesCfgFilter(entries[0], '')).toBe(true);
        });
    });
});
