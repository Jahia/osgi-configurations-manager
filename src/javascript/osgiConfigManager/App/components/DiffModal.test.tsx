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
        expect(dialog.getAttribute('aria-label')).toBe('modal.diff.title');
        // getByRole throws if the accessible confirm button is missing
        screen.getByRole('button', { name: 'app.save' });
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
});
