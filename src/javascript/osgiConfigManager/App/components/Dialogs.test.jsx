import React from 'react';
import {render, screen, fireEvent, within, waitFor, act} from '@testing-library/react';
import {ModalDialog} from './Dialogs';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

describe('ModalDialog create configuration options', () => {
    const config = {
        type: 'createConfig',
        title: 'modal.create.title',
        deferConfirm: false,
        availableMetatypes: [
            {pid: 'org.example.alpha', name: 'Alpha', description: 'First template', filename: 'org.example.alpha.cfg'},
            {pid: 'org.example.beta', name: 'Beta', filename: 'org.example.beta.cfg'},
            {pid: 'org.example.factory', name: 'Factory', factory: true, filename: 'org.example.factory-*.cfg', instances: []}
        ]
    };

    // The options were clickable divs: unreachable by keyboard, selection shown by colour only.
    it('offers the Metatype templates as a named group of radios', () => {
        const onConfirm = jest.fn();
        render(<ModalDialog config={{...config, onConfirm}} onClose={jest.fn()}/>);
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.configuration'}));

        const group = screen.getByRole('radiogroup', {name: 'modal.create.templateLabel modal.create.required'});
        const radios = within(group).getAllByRole('radio');
        expect(radios).toHaveLength(2);
        expect(radios.every(radio => !radio.checked)).toBe(true);

        fireEvent.click(within(group).getByRole('radio', {name: /Beta/}));
        expect(within(group).getByRole('radio', {name: /Beta/}).checked).toBe(true);

        fireEvent.click(screen.getByRole('button', {name: 'modal.ok'}));
        expect(onConfirm).toHaveBeenCalledWith({mode: 'metatype', pid: 'org.example.beta'});
    });

    it('offers the factories as a separate named group of radios', () => {
        render(<ModalDialog config={{...config, onConfirm: jest.fn()}} onClose={jest.fn()}/>);
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.factory'}));

        const group = screen.getByRole('radiogroup', {name: 'modal.create.factoryLabel modal.create.required'});
        const radio = within(group).getByRole('radio', {name: /Factory/});
        fireEvent.click(radio);
        expect(radio.checked).toBe(true);
    });

    it('does not draw a description with a translucent colour token', () => {
        render(<ModalDialog config={{...config, onConfirm: jest.fn()}} onClose={jest.fn()}/>);
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.configuration'}));

        expect(screen.getByText('First template').style.color).toBe('var(--color-gray_dark)');
    });
});

// The create dialog closed before the name was checked: an invalid extension or a server error
// replaced it, and the name had to be typed again (WCAG 3.3.1, 3.3.7).
describe('ModalDialog create with awaitConfirm', () => {
    const createConfig = onConfirm => ({
        type: 'createConfig',
        title: 'modal.create.title',
        confirmLabel: 'modal.create.confirm',
        awaitConfirm: true,
        availableMetatypes: [],
        onConfirm
    });

    it('stays open with the typed name and shows the error on the field', async () => {
        const onClose = jest.fn();
        const onConfirm = jest.fn().mockResolvedValue({ok: false, field: 'filename', message: 'modal.error.invalidExtension'});
        render(<ModalDialog config={createConfig(onConfirm)} onClose={onClose}/>);

        const input = screen.getByRole('textbox', {name: 'modal.create.manualLabel modal.create.required'});
        fireEvent.change(input, {target: {value: 'org.example.txt'}});
        fireEvent.click(screen.getByRole('button', {name: 'modal.create.confirm'}));

        await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
        expect(onConfirm).toHaveBeenCalledWith({mode: 'manual', filename: 'org.example.txt'});
        expect(onClose).not.toHaveBeenCalled();
        expect(input.value).toBe('org.example.txt');
        expect(input.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id).textContent))
            .toEqual(['modal.create.manualHint', 'modal.error.invalidExtension']);
        expect(document.activeElement).toBe(input);

        fireEvent.change(input, {target: {value: 'org.example.cfg'}});
        expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('closes once the action succeeded', async () => {
        const onClose = jest.fn();
        render(<ModalDialog config={createConfig(jest.fn().mockResolvedValue({ok: true}))} onClose={onClose}/>);

        fireEvent.change(screen.getByRole('textbox', {name: 'modal.create.manualLabel modal.create.required'}), {target: {value: 'org.example.cfg'}});
        fireEvent.click(screen.getByRole('button', {name: 'modal.create.confirm'}));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('states the allowed extensions before submission', () => {
        render(<ModalDialog config={createConfig(jest.fn())} onClose={jest.fn()}/>);

        const input = screen.getByRole('textbox', {name: 'modal.create.manualLabel modal.create.required'});
        expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('modal.create.manualHint');
    });
});

describe('ModalDialog import conflict and focus return', () => {
    const conflict = onOther => ({
        type: 'confirm',
        title: 'modal.conflict.title',
        message: 'modal.conflict.message',
        confirmLabel: 'modal.conflict.overwrite',
        otherLabel: 'modal.conflict.rename',
        onConfirm: jest.fn(),
        onOther
    });

    // The dialog had stopped drawing its third choice: Rename was unreachable.
    it('offers Rename, which closes the dialog and hands over', () => {
        const onClose = jest.fn();
        const onOther = jest.fn();
        render(<ModalDialog config={conflict(onOther)} onClose={onClose}/>);

        fireEvent.click(screen.getByRole('button', {name: 'modal.conflict.rename'}));
        expect(onClose).toHaveBeenCalled();
        expect(onOther).toHaveBeenCalled();
    });

    // Moonstone's Modal gave the focus to <body> on close.
    it('gives the focus back to the element that opened it', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();

        const {rerender} = render(<ModalDialog config={conflict(jest.fn())} onClose={jest.fn()}/>);
        screen.getByRole('button', {name: 'modal.conflict.overwrite'}).focus();
        rerender(<ModalDialog config={null} onClose={jest.fn()}/>);

        await waitFor(() => expect(document.activeElement).toBe(opener));
        opener.remove();
    });
});

describe('ModalDialog batch 4 (dialogs)', () => {
    const create = {
        type: 'createConfig',
        title: 'modal.create.title',
        confirmLabel: 'modal.create.confirm',
        availableMetatypes: [
            {pid: 'org.example.alpha', name: 'Alpha', filename: 'org.example.alpha.cfg'},
            {pid: 'org.example.factory', name: 'Factory', factory: true, filename: 'org.example.factory-*.cfg',
                instances: [{identifier: 'one', filename: 'org.example.factory-one.cfg'}]}
        ],
        onConfirm: jest.fn()
    };

    // The dialog focuses its first control: the X came first and was named like the footer's Cancel.
    it('puts the Close button after the footer, named Close', () => {
        render(<ModalDialog config={{type: 'confirm', title: 't', message: 'm', onConfirm: jest.fn()}} onClose={jest.fn()}/>);
        const buttons = screen.getAllByRole('button').filter(button => !button.hasAttribute('data-floating-ui-focus-guard'));
        expect(buttons[buttons.length - 1].getAttribute('aria-label')).toBe('modal.close');
        expect(screen.queryByRole('button', {name: 'modal.cancel'})).not.toBeNull();
        expect(screen.getAllByRole('button', {name: 'modal.cancel'})).toHaveLength(1);
    });

    it('is an alertdialog when it confirms a destructive action', () => {
        render(<ModalDialog config={{type: 'confirm', severity: 'warning', title: 't', message: 'm', onConfirm: jest.fn()}} onClose={jest.fn()}/>);
        expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('names the tab list and ties the selected tab to its panel', () => {
        render(<ModalDialog config={create} onClose={jest.fn()}/>);
        expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('modal.create.tabsLabel');
        const manual = screen.getByRole('tab', {name: 'modal.create.tabs.manual'});
        const panel = screen.getByRole('tabpanel');
        expect(manual.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.getAttribute('aria-labelledby')).toBe(manual.id);
        expect(screen.getByRole('tab', {name: 'modal.create.tabs.factory'}).getAttribute('aria-controls')).toBeNull();
    });

    // Choosing a template cleared the name typed in Manual (WCAG 3.3.7).
    it('keeps the filename typed in Manual when an option is chosen', () => {
        render(<ModalDialog config={create} onClose={jest.fn()}/>);
        fireEvent.change(screen.getByRole('textbox', {name: 'modal.create.manualLabel modal.create.required'}), {target: {value: 'my.cfg'}});
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.configuration'}));
        fireEvent.click(screen.getByRole('radio', {name: /Alpha/}));
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.manual'}));
        expect(screen.getByRole('textbox', {name: 'modal.create.manualLabel modal.create.required'}).value).toBe('my.cfg');
    });

    it('says how many options the filter leaves, after a pause', () => {
        jest.useFakeTimers();
        try {
            render(<ModalDialog config={create} onClose={jest.fn()}/>);
            fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.configuration'}));
            const status = document.querySelector('[data-cy="modal-create-filter-count"]');
            expect(status.textContent).toBe('');
            const filter = document.querySelector('[data-cy="modal-create-filter-input"] input, input[data-cy="modal-create-filter-input"]');
            fireEvent.change(filter, {target: {value: 'alp'}});
            act(() => {
                jest.advanceTimersByTime(500);
            });
            expect(status.textContent).toBe('modal.create.configurationCount');
        } finally {
            jest.useRealTimers();
        }
    });

    it('lists the existing instances in a named, focusable region, and marks the identifier required', () => {
        render(<ModalDialog config={create} onClose={jest.fn()}/>);
        fireEvent.click(screen.getByRole('tab', {name: 'modal.create.tabs.factory'}));
        fireEvent.click(screen.getByRole('radio', {name: /Factory/}));
        const region = screen.getByRole('region', {name: 'modal.create.existingInstances'});
        expect(region.tabIndex).toBe(0);
        expect(within(region).getAllByRole('listitem')).toHaveLength(1);
        const identifier = document.querySelector('[data-cy="modal-create-factory-identifier-input"] input, input[data-cy="modal-create-factory-identifier-input"]');
        expect(identifier.getAttribute('aria-required')).toBe('true');
        expect(document.activeElement).not.toBe(identifier);
    });
});
