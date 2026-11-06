import React from 'react';
import {render, screen} from '@testing-library/react';
import {ConfigStateBadge} from './ConfigStateBadge';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

describe('ConfigStateBadge', () => {
    it('renders the regular label for the provided state', () => {
        render(<ConfigStateBadge state="MODULE"/>);

        expect(screen.getByText('configState.badge.module')).toBeInTheDocument();
    });

    // The compact chip is an icon only: its state stays available as text to screen readers.
    it('renders an icon-only chip with the state as visually hidden text when compact', () => {
        const {container} = render(<ConfigStateBadge state="MODULE_DEFAULT" compact/>);

        const chip = container.querySelector('[data-cy="config-state-badge-module_default"]');
        expect(chip).toBeInTheDocument();
        expect(chip.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(screen.getByText(/configState\.badge\.moduleDefault/).style.position).toBe('absolute');
    });

    it('falls back to the user state for unknown values', () => {
        render(<ConfigStateBadge state="UNKNOWN_STATE" showTooltip={false}/>);

        expect(screen.getByText('configState.badge.user')).toBeInTheDocument();
    });
});
