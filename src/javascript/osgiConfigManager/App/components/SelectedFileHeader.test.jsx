import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {SelectedFileHeader} from './SelectedFileHeader';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => (options ? `${key}:${Object.values(options).join(':')}` : key)
    })
}));

const renderHeader = (props = {}) => render(
    <SelectedFileHeader
        selectedFile={{name: 'org.example.yml', path: '/etc/org.example.yml'}}
        selectedConfigState="USER"
        hasUnsaved
        isRawMode
        isYamlValid
        validationErrors={[]}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        {...props}
    />
);

// Save was silently disabled while the content had errors: nothing said why, and a disabled
// button cannot be reached to hear a description.
describe('SelectedFileHeader blocked save', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const errors = [
        {line: 3, message: 'Unexpected token'},
        {line: 9, message: 'Missing key'}
    ];

    it('keeps Save focusable, refuses the click and describes it by the reason', () => {
        const onSave = jest.fn();
        renderHeader({isYamlValid: false, validationErrors: errors, onSave});

        const save = screen.getByRole('button', {name: 'app.save'});
        expect(save).not.toBeDisabled();
        expect(save.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(save);
        expect(onSave).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(1500);
        });
        const reason = document.getElementById(save.getAttribute('aria-describedby'));
        expect(reason.getAttribute('role')).toBe('status');
        expect(reason.textContent).toBe('editor.validation.saveBlocked:2');
        expect(screen.getByText('editor.validation.errorAt:3:Unexpected token')).toBeInTheDocument();
    });

    // Typing passes through invalid states: the reason waits until they last.
    it('says nothing while the content is only briefly invalid', () => {
        const {rerender} = renderHeader({isYamlValid: false, validationErrors: errors});
        const status = screen.getByRole('status');
        expect(status.textContent).toBe('');

        rerender(
            <SelectedFileHeader
                selectedFile={{name: 'org.example.yml', path: '/etc/org.example.yml'}}
                selectedConfigState="USER"
                hasUnsaved
                isRawMode
                isYamlValid
                validationErrors={[]}
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />
        );
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(status.textContent).toBe('');
        expect(screen.getByRole('button', {name: 'app.save'}).getAttribute('aria-disabled')).toBeNull();
    });

    it('saves normally when the content is valid', () => {
        const onSave = jest.fn();
        renderHeader({onSave});

        fireEvent.click(screen.getByRole('button', {name: 'app.save'}));
        expect(onSave).toHaveBeenCalled();
    });
});

// When a confirmed save or a cancel ended, the focused button became disabled and the focus fell to
// the page. Unavailable, Save and Cancel stay focusable and refuse the click instead.
describe('SelectedFileHeader unavailable buttons', () => {
    it('never sets the disabled attribute, with or without changes', () => {
        const {rerender} = renderHeader({hasUnsaved: false});
        const buttons = () => [
            screen.getByRole('button', {name: 'app.save'}),
            screen.getByRole('button', {name: 'modal.cancel'})
        ];

        buttons().forEach(button => {
            expect(button).not.toBeDisabled();
            expect(button.getAttribute('aria-disabled')).toBe('true');
        });

        rerender(
            <SelectedFileHeader
                selectedFile={{name: 'org.example.yml', path: '/etc/org.example.yml'}}
                selectedConfigState="USER"
                hasUnsaved
                isRawMode
                isYamlValid
                validationErrors={[]}
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />
        );
        buttons().forEach(button => {
            expect(button).not.toBeDisabled();
            expect(button.getAttribute('aria-disabled')).toBeNull();
        });
    });

    it('keeps the focus on Save when the changes are saved', () => {
        const {rerender} = renderHeader();
        const save = screen.getByRole('button', {name: 'app.save'});
        save.focus();

        rerender(
            <SelectedFileHeader
                selectedFile={{name: 'org.example.yml', path: '/etc/org.example.yml'}}
                selectedConfigState="USER"
                hasUnsaved={false}
                isRawMode
                isYamlValid
                validationErrors={[]}
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />
        );

        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'app.save'}));
    });

    it('refuses Save and Cancel while nothing changed', () => {
        const onSave = jest.fn();
        const onCancel = jest.fn();
        renderHeader({hasUnsaved: false, onSave, onCancel});

        fireEvent.click(screen.getByRole('button', {name: 'app.save'}));
        fireEvent.click(screen.getByRole('button', {name: 'modal.cancel'}));

        expect(onSave).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    // Nothing showed that a save was running, and Save stayed active meanwhile.
    it('shows the save in progress and refuses Save and Cancel meanwhile', () => {
        const onSave = jest.fn();
        const onCancel = jest.fn();
        renderHeader({isSaving: true, onSave, onCancel});

        expect(screen.getByText('app.saving')).toBeInTheDocument();
        const save = screen.getByRole('button', {name: 'app.save'});
        expect(save.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(save);
        fireEvent.click(screen.getByRole('button', {name: 'modal.cancel'}));

        expect(onSave).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });
});
