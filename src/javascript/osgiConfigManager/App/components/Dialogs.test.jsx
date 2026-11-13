import React from 'react';
import {render, screen, fireEvent, within, waitFor} from '@testing-library/react';
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

        const group = screen.getByRole('radiogroup', {name: 'modal.create.templateLabel'});
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

        const group = screen.getByRole('radiogroup', {name: 'modal.create.factoryLabel'});
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

        const input = screen.getByRole('textbox', {name: 'modal.create.manualLabel'});
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

        fireEvent.change(screen.getByRole('textbox', {name: 'modal.create.manualLabel'}), {target: {value: 'org.example.cfg'}});
        fireEvent.click(screen.getByRole('button', {name: 'modal.create.confirm'}));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('states the allowed extensions before submission', () => {
        render(<ModalDialog config={createConfig(jest.fn())} onClose={jest.fn()}/>);

        const input = screen.getByRole('textbox', {name: 'modal.create.manualLabel'});
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
