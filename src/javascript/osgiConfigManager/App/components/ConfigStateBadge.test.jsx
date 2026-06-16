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

    it('renders the compact label when compact mode is enabled', () => {
        const {container} = render(<ConfigStateBadge state="MODULE_DEFAULT" compact/>);

        expect(screen.queryByText('configState.badge.moduleDefault')).not.toBeInTheDocument();
        expect(container.querySelector('[data-cy="config-state-badge-module_default"]')).toBeInTheDocument();
    });

    it('falls back to the user state for unknown values', () => {
        render(<ConfigStateBadge state="UNKNOWN_STATE" showTooltip={false}/>);

        expect(screen.getByText('configState.badge.user')).toBeInTheDocument();
    });

    it('exposes the badge as a labelled img so aria-label/aria-describedby are permitted (no aria-prohibited-attr)', () => {
        // The Chip renders a <div>; without an explicit role the generic role prohibits aria-label.
        // role="img" + an accessible name keeps axe's aria-prohibited-attr rule satisfied.
        render(<ConfigStateBadge state="MODULE" showTooltip={false}/>);

        expect(screen.getByRole('img', {name: 'configState.badge.module'})).toBeInTheDocument();
    });

    it('keeps the full state as the accessible name even in compact (icon-only) mode', () => {
        render(<ConfigStateBadge state="MODULE_DEFAULT" compact showTooltip={false}/>);

        expect(screen.getByRole('img', {name: 'configState.badge.moduleDefault'})).toBeInTheDocument();
    });
});
