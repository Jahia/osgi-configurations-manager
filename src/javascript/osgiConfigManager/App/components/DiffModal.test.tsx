import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffModal } from './DiffModal';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

describe('DiffModal accessibility', () => {
    const baseProps = {
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        originalContent: 'a = 1\n',
        newContent: 'a = 2\n',
        filename: 'test.cfg'
    };

    it('renders nothing when closed', () => {
        const { container } = render(<DiffModal isOpen={false} {...baseProps} />);
        expect(container.firstChild).toBeNull();
    });

    it('exposes a dialog role with an accessible name and a confirm button', () => {
        render(<DiffModal isOpen={true} {...baseProps} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        // Named by its visible title.
        expect(screen.getByRole('dialog', { name: 'modal.diff.title' })).toBe(dialog);
        // getByRole throws if the accessible confirm button is missing
        screen.getByRole('button', { name: 'app.save' });
        // The close icon was a div: a named button now.
        screen.getByRole('button', { name: 'modal.close' });
    });

    // Added and removed lines differed only by colour.
    it('marks added and removed lines in text, not only in colour', () => {
        render(<DiffModal isOpen={true} {...baseProps} />);

        const changes = screen.getByRole('region', { name: 'modal.diff.changes' });
        expect(changes.getAttribute('tabindex')).toBe('0');
        const removed = changes.querySelector('del') as HTMLElement;
        const added = changes.querySelector('ins') as HTMLElement;
        expect(removed.textContent).toBe('−modal.diff.removed a = 1');
        expect(added.textContent).toBe('+modal.diff.added a = 2');
    });

    it('makes the page behind it inert while open, and gives the focus back on close', () => {
        const opener = document.createElement('button');
        const behind = document.createElement('div');
        document.body.append(opener, behind);
        opener.focus();

        const { rerender } = render(<DiffModal isOpen={true} {...baseProps} />);
        expect(behind.hasAttribute('inert')).toBe(true);
        expect(opener.hasAttribute('inert')).toBe(true);

        rerender(<DiffModal isOpen={false} {...baseProps} />);
        expect(behind.hasAttribute('inert')).toBe(false);
        expect(document.activeElement).toBe(opener);
        opener.remove();
        behind.remove();
    });

    it('moves focus inside the dialog when it opens', () => {
        render(<DiffModal isOpen={true} {...baseProps} />);

        // Guards the focus trap itself, not just the attributes: if the container ref never
        // attached, focus would stay on <body> and Tab would escape the dialog silently.
        expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });

    it('closes on Escape', () => {
        const onClose = jest.fn();
        render(<DiffModal isOpen={true} {...baseProps} onClose={onClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();
    });

describe('DiffModal masking of secrets', () => {
    const baseProps = {
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        filename: 'db.cfg',
        originalContent: 'url = https://x\npassword = old-secret\n',
        newContent: 'url = https://y\npassword = new-secret\ncredential = provider\n'
    };
    const bodyText = () => (document.querySelector('[data-cy="diff-modal"]') as HTMLElement).textContent || '';

    it('masks the secret values on both sides of the diff, and shows that one changed', () => {
        render(<DiffModal isOpen={true} {...baseProps} metatypeDefinition={{ properties: [{ id: 'credential', type: 'password' }] }} />);

        const text = bodyText();
        expect(text).not.toContain('old-secret');
        expect(text).not.toContain('new-secret');
        expect(text).not.toContain('provider');
        expect(text).toContain('password = \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
        expect(text).toContain('https://y');
    });

    it('shows the values on request, and masks them again at the next opening', () => {
        const { rerender } = render(<DiffModal isOpen={true} {...baseProps} />);
        const toggle = () => document.querySelector('[data-cy="diff-modal-toggle-secrets"]') as HTMLElement;

        expect(toggle().getAttribute('data-state')).toBe('masked');
        fireEvent.click(screen.getByRole('button', { name: 'editor.button.showSecretsInDiff' }));
        expect(bodyText()).toContain('new-secret');

        rerender(<DiffModal isOpen={false} {...baseProps} />);
        rerender(<DiffModal isOpen={true} {...baseProps} />);
        expect(bodyText()).not.toContain('new-secret');
    });

    it('offers no toggle when the file holds no secret', () => {
        render(<DiffModal isOpen={true} {...baseProps} originalContent={'a = 1\n'} newContent={'a = 2\n'} />);
        expect(document.querySelector('[data-cy="diff-modal-toggle-secrets"]')).toBeNull();
    });
});
});
