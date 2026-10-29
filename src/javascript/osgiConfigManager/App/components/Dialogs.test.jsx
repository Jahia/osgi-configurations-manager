import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
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
