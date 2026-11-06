import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CfgMetatypePropertyDialog } from './CfgMetatypePropertyDialog';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));

describe('CfgMetatypePropertyDialog accessibility', () => {
    const baseProps = {
        properties: [{ id: 'foo.bar', type: 'String' }],
        existingKeys: new Set(),
        onClose: jest.fn(),
        onSelectMetatypeProperty: jest.fn(),
        onCreateCustomProperty: jest.fn()
    };

    it('renders nothing when closed', () => {
        render(<CfgMetatypePropertyDialog open={false} {...baseProps} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('is a labelled dialog with keyboard-operable options and closes on Escape', () => {
        const onClose = jest.fn();
        render(<CfgMetatypePropertyDialog open={true} {...baseProps} onClose={onClose} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(screen.getByRole('dialog', { name: 'editor.metatype.cfgPicker.title' })).toBe(dialog);
        // each property option is a button named by its content: id, type, default, description
        screen.getByRole('button', { name: /^foo\.bar/ });
        screen.getByRole('button', { name: 'modal.close' });
        expect(document.querySelector('[data-cy="cfg-metatype-property-count"]')?.getAttribute('role')).toBe('status');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    // autoFocus took the focus before the dialog recorded the opener, so it fell to <body> on close.
    it('focuses the search field and gives the focus back to the opener on close', () => {
        const opener = document.createElement('button');
        document.body.append(opener);
        opener.focus();

        const { rerender } = render(<CfgMetatypePropertyDialog open={true} {...baseProps} />);
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'editor.metatype.cfgPicker.searchPlaceholder' }));

        rerender(<CfgMetatypePropertyDialog open={false} {...baseProps} />);
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    // Enter on a name that already exists closed the dialog without adding or saying anything.
    it('stays open and flags the field when the typed property already exists', () => {
        const onClose = jest.fn();
        const onCreateCustomProperty = jest.fn();
        render(<CfgMetatypePropertyDialog open={true} {...baseProps} existingKeys={new Set(['custom.key'])} onClose={onClose} onCreateCustomProperty={onCreateCustomProperty} />);

        const field = screen.getByRole('textbox');
        fireEvent.change(field, { target: { value: 'custom.key' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(onClose).not.toHaveBeenCalled();
        expect(onCreateCustomProperty).not.toHaveBeenCalled();
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(field.getAttribute('aria-describedby')).toContain(screen.getByText('editor.metatype.cfgPicker.customAlreadyExists').id);
    });
});
