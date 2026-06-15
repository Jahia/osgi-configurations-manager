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
        // each property option is exposed as a button named by its id (keyboard reachable)
        screen.getByRole('button', { name: 'foo.bar' });

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
