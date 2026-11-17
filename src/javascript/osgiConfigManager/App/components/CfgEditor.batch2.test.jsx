import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {CfgEditor, valueHintFor} from './CfgEditor';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (!options) {
                return key;
            }
            const values = ['key', 'name', 'position', 'positions', 'values', 'count'].filter(name => options[name] !== undefined).map(name => options[name]);
            return values.length ? `${key}:${values.join(':')}` : key;
        }
    })
}));

jest.mock('./CfgMetatypePropertyDialog', () => ({
    CfgMetatypeInfoTooltip: () => null,
    CfgMetatypePropertyDialog: () => null
}));

const renderEditor = (entries, props = {}) => render(
    <CfgEditor
        entries={entries}
        handlePropUpdate={jest.fn()}
        handleDeleteProperty={jest.fn()}
        handleAddCfgEntry={jest.fn()}
        handleReorder={jest.fn()}
        setModalConfig={jest.fn()}
        handleToggleEncryption={jest.fn()}
        setShowComments={jest.fn()}
        setShowEmptyLines={jest.fn()}
        metatypeDefinition={null}
        showComments
        showEmptyLines
        {...props}
    />
);

describe('CfgEditor with no row to show', () => {
    it('says the file has no entries', () => {
        renderEditor([]);
        expect(document.querySelector('[data-cy="cfg-table-empty"]').textContent).toBe('editor.tableEmpty.noEntries');
    });

    it('says how to show lines that the toggles hide', () => {
        renderEditor([{type: 'comment', value: '# x'}], {showComments: false});
        expect(document.querySelector('[data-cy="cfg-table-empty"]').textContent).toBe('editor.tableEmpty.allHidden');
    });

    it('says nothing matches the filter', () => {
        renderEditor([{type: 'property', key: 'a', value: '1'}]);
        fireEvent.change(screen.getByRole('searchbox', {name: 'editor.filter.label'}), {target: {value: 'zzz'}});
        expect(document.querySelector('[data-cy="cfg-table-empty"]').textContent).toBe('editor.tableEmpty.noMatch');
    });

    it('shows no message when a row is shown', () => {
        renderEditor([{type: 'property', key: 'a', value: '1'}]);
        expect(document.querySelector('[data-cy="cfg-table-empty"]')).toBeNull();
    });
});

describe('CfgEditor selected row', () => {
    const entries = [
        {type: 'property', key: 'a', value: '1'},
        {type: 'property', key: 'b', value: '2'}
    ];

    // The row that decides where Add inserts was shown by its background colour only.
    it('marks the selected row and tells the Add buttons where they insert', () => {
        renderEditor(entries);
        const addButton = document.querySelector('[data-cy="cfg-add-property"] button');
        const description = () => document.getElementById(addButton.getAttribute('aria-describedby').split(' ')[0]).textContent;
        expect(description()).toBe('editor.insertPosition.end');

        fireEvent.focus(document.querySelector('[data-cy="cfg-key-0"]'));

        expect(document.querySelector('[data-cy="cfg-row-0"]').getAttribute('aria-current')).toBe('true');
        expect(document.querySelector('[data-cy="cfg-row-1"]').getAttribute('aria-current')).toBeNull();
        expect(document.querySelector('[data-cy="cfg-drag-zone-0"]').getAttribute('data-selected')).toBe('true');
        expect(description()).toBe('editor.insertPosition.after:a');
    });
});

describe('CfgEditor Metatype guidance', () => {
    const metatypeDefinition = {
        pid: 'x',
        properties: [
            {id: 'enabled', type: 'boolean', optional: false, defaultValues: ['true']},
            {id: 'port', type: 'integer', optional: false, defaultValues: []},
            {id: 'name', type: 'string', optional: true}
        ]
    };

    it('marks as required only a required value with no default', () => {
        renderEditor([
            {type: 'property', key: 'enabled', value: 'true'},
            {type: 'property', key: 'port', value: ''}
        ], {metatypeDefinition});

        expect(document.querySelector('[data-cy="cfg-value-0"]').getAttribute('aria-required')).toBeNull();
        expect(document.querySelector('[data-cy="cfg-value-1"]').getAttribute('aria-required')).toBe('true');
        expect(document.querySelector('[data-cy="cfg-required-1"]').getAttribute('aria-hidden')).toBe('true');
        expect(document.querySelector('[data-cy="cfg-required-legend"]')).not.toBeNull();
    });

    it('describes the expected value under the field', () => {
        renderEditor([{type: 'property', key: 'port', value: '80'}, {type: 'property', key: 'name', value: 'x'}], {metatypeDefinition});

        const field = document.querySelector('[data-cy="cfg-value-0"]');
        expect(document.getElementById(field.getAttribute('aria-describedby')).textContent).toBe('editor.valueHint.wholeNumber');
        expect(document.querySelector('[data-cy="cfg-value-1"]').getAttribute('aria-describedby')).toBeNull();
    });

    it('lists a few allowed values, then how many more, and says when a list is taken', () => {
        const t = (key, options) => (options ? `${key}:${Object.values(options).join(':')}` : key);
        const options = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(value => ({value, label: value.toUpperCase()}));
        expect(valueHintFor({type: 'string', options}, t)).toBe('editor.valueHint.options:editor.valueHint.more:a, b, c, d, e:2');
        expect(valueHintFor({type: 'integer', cardinality: -1}, t)).toBe('editor.valueHint.wholeNumber (editor.valueHint.list)');
        expect(valueHintFor({type: 'password'}, t)).toBe('');
    });
});

describe('CfgEditor key errors', () => {
    const entries = [
        {type: 'property', key: 'a', value: '1'},
        {type: 'property', key: '', value: '2'},
        {type: 'property', key: 'A', value: '3'}
    ];

    it('shows nothing before a save was refused', () => {
        renderEditor(entries);
        expect(document.querySelector('[data-cy="cfg-key-1"]').getAttribute('aria-invalid')).toBeNull();
    });

    it('says what is wrong with each faulty key, and where the duplicate is', () => {
        renderEditor(entries, {showKeyProblems: true});

        const blank = document.querySelector('[data-cy="cfg-key-1"]');
        expect(blank.getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById(blank.getAttribute('aria-describedby')).textContent).toBe('editor.validation.emptyKeyField');

        const first = document.querySelector('[data-cy="cfg-key-0"]');
        expect(document.getElementById(first.getAttribute('aria-describedby')).textContent).toBe('editor.validation.duplicateKeyField:3');
        const third = document.querySelector('[data-cy="cfg-key-2"]');
        expect(document.getElementById(third.getAttribute('aria-describedby')).textContent).toBe('editor.validation.duplicateKeyField:1');
    });

    it('focuses the first faulty key on a refused save, clearing a filter that hides it', () => {
        const {rerender} = renderEditor(entries, {showKeyProblems: true, keyProblemsFocusRequest: 0});
        fireEvent.change(screen.getByRole('searchbox', {name: 'editor.filter.label'}), {target: {value: 'zzz'}});
        jest.useFakeTimers();
        try {
            rerender(
                <CfgEditor
                    entries={entries}
                    handlePropUpdate={jest.fn()}
                    handleDeleteProperty={jest.fn()}
                    handleAddCfgEntry={jest.fn()}
                    handleReorder={jest.fn()}
                    setModalConfig={jest.fn()}
                    handleToggleEncryption={jest.fn()}
                    metatypeDefinition={null}
                    showComments
                    showEmptyLines
                    showKeyProblems
                    keyProblemsFocusRequest={1}
                />
            );
            act(() => {
                jest.advanceTimersByTime(100);
            });
            expect(document.activeElement).toBe(document.querySelector('[data-cy="cfg-key-0"]'));
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('CfgEditor row delete', () => {
    // After the confirmation the focus went to the Delete button of the row that took the deleted
    // one's place, or to <body> for the last row.
    it('names the row and returns the focus to the row that takes its place', () => {
        const handleDeleteProperty = jest.fn();
        renderEditor([
            {type: 'property', key: 'a', value: '1'},
            {type: 'comment', value: '# note'}
        ], {handleDeleteProperty});

        fireEvent.click(document.querySelector('[data-cy="cfg-delete-0"]'));

        const [path, options] = handleDeleteProperty.mock.calls[0];
        expect(path).toEqual([0]);
        expect(options.name).toBe('a');
        // Without a re-render the row at index 0 is still "a": its first field is the key.
        expect(options.returnFocus()).toBe(document.querySelector('[data-cy="cfg-key-0"]'));
    });
});
