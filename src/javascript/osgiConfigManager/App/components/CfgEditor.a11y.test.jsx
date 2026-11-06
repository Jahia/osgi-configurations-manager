import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {CfgEditor} from './CfgEditor';

// The mock spells out the interpolated values, so a test can tell which row a label names.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (!options) {
                return key;
            }
            const values = ['key', 'name', 'position', 'total'].filter(name => options[name] !== undefined).map(name => options[name]);
            return values.length ? `${key}:${values.join(':')}` : key;
        }
    })
}));

jest.mock('./CfgMetatypePropertyDialog', () => ({
    CfgMetatypeInfoTooltip: () => null,
    CfgMetatypePropertyDialog: () => null
}));

const noop = jest.fn();

const renderEditor = (entries, props = {}) => render(
    <CfgEditor
        entries={entries}
        handlePropUpdate={noop}
        handleDeleteProperty={noop}
        handleAddCfgEntry={noop}
        handleReorder={noop}
        setModalConfig={noop}
        handleToggleEncryption={noop}
        metatypeDefinition={null}
        showComments
        showEmptyLines
        {...props}
    />
);

describe('CfgEditor encryption checkbox', () => {
    // A title on the surrounding cell does not name the input: screen readers said only "checkbox".
    it('names each encryption checkbox after its property', () => {
        renderEditor([
            {type: 'property', key: 'db.url', value: 'jdbc:x'},
            {type: 'property', key: '', value: 'orphan'}
        ]);

        expect(screen.getByRole('checkbox', {name: 'editor.encryptValueOf:db.url'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'editor.encryptValueOf:#2'})).toBeInTheDocument();
    });
});

describe('CfgEditor fields and table structure', () => {
    const entries = [
        {type: 'property', key: 'db.url', value: 'jdbc:x'},
        {type: 'comment', value: '# note'},
        {type: 'property', key: 'db.user', value: 'admin'}
    ];

    // Every value field was named "Value" (its placeholder), the comment field had no name at all.
    it('names every field after its row', () => {
        renderEditor(entries);

        expect(screen.getByRole('textbox', {name: 'editor.aria.value:db.url'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'editor.aria.value:db.user'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'editor.aria.key:1'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'editor.aria.comment:editor.entry.comment:2'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'editor.aria.delete:db.user'})).toBeInTheDocument();
    });

    it('has a named table with column headers and no Tab stop on its rows', () => {
        const {container} = renderEditor(entries);

        expect(screen.getByRole('table', {name: 'editor.aria.table'})).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader')).toHaveLength(6);
        expect(container.querySelectorAll('tr[tabindex]')).toHaveLength(0);
    });
});

describe('CfgEditor reordering', () => {
    const entries = [
        {type: 'property', key: 'alpha', value: '1'},
        {type: 'comment', value: '# hidden'},
        {type: 'property', key: 'beta', value: '2'}
    ];

    beforeAll(() => {
        window.requestAnimationFrame = callback => callback();
    });

    // With comments hidden, a move used to swap with the invisible comment and seem to do nothing.
    it('moves past hidden rows and says where the entry went', () => {
        const handleReorder = jest.fn();
        renderEditor(entries, {handleReorder, showComments: false});

        fireEvent.keyDown(screen.getByRole('button', {name: 'editor.aria.reorder:beta'}), {key: 'ArrowUp'});

        expect(handleReorder).toHaveBeenCalledWith(2, 0);
        expect(screen.getByText('editor.aria.moved:beta:1:2')).toBeInTheDocument();
    });

    // Dragging was the only way to reorder with a pointer.
    it('moves an entry with the one-click buttons, which stop at the ends', () => {
        const handleReorder = jest.fn();
        renderEditor(entries, {handleReorder});

        expect(screen.getByRole('button', {name: 'editor.aria.moveUp:alpha'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button', {name: 'editor.aria.moveDown:alpha'}));

        expect(handleReorder).toHaveBeenCalledWith(0, 1);
    });

    it('keeps the focus on the moved entry', () => {
        const Harness = () => {
            const [rows, setRows] = React.useState(entries);
            const handleReorder = (from, to) => setRows(previous => {
                const next = [...previous];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                return next;
            });
            return (
                <CfgEditor
                    entries={rows}
                    handlePropUpdate={noop}
                    handleDeleteProperty={noop}
                    handleAddCfgEntry={noop}
                    handleReorder={handleReorder}
                    setModalConfig={noop}
                    handleToggleEncryption={noop}
                    metatypeDefinition={null}
                    showComments
                    showEmptyLines
                />
            );
        };
        render(<Harness/>);

        const handle = screen.getByRole('button', {name: 'editor.aria.reorder:beta'});
        handle.focus();
        act(() => {
            fireEvent.keyDown(handle, {key: 'ArrowUp'});
        });

        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'editor.aria.reorder:beta'}));
        expect(document.activeElement.getAttribute('data-cy')).toBe('cfg-reorder-1');
    });
});
