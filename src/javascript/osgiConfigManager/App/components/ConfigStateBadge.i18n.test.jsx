import React from 'react';
import { render } from '@testing-library/react';
import { ConfigStateBadge } from './ConfigStateBadge';

// S37-NEW (G19): the badge renders through stable i18n keys (never hardcoded English), so the
// 6-language claim is structurally verifiable. We spy on `t` and assert the exact keys requested.

const mockT = jest.fn(key => key);
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (...args) => mockT(...args) })
}));

describe('ConfigStateBadge — i18n key usage', () => {
    beforeEach(() => mockT.mockClear());

    it('MODULE uses the module label + tooltip keys', () => {
        render(<ConfigStateBadge state="MODULE" />);
        expect(mockT).toHaveBeenCalledWith('configState.badge.module');
        expect(mockT).toHaveBeenCalledWith('configState.tooltip.module');
    });

    it('MODULE_DEFAULT uses the moduleDefault label + tooltip keys', () => {
        render(<ConfigStateBadge state="MODULE_DEFAULT" />);
        expect(mockT).toHaveBeenCalledWith('configState.badge.moduleDefault');
        expect(mockT).toHaveBeenCalledWith('configState.tooltip.moduleDefault');
    });

    it('USER uses the user label + tooltip keys', () => {
        render(<ConfigStateBadge state="USER" />);
        expect(mockT).toHaveBeenCalledWith('configState.badge.user');
        expect(mockT).toHaveBeenCalledWith('configState.tooltip.user');
    });

    it('compact mode skips the label key but still resolves the tooltip key', () => {
        render(<ConfigStateBadge state="MODULE" compact />);
        expect(mockT).not.toHaveBeenCalledWith('configState.badge.module');
        expect(mockT).toHaveBeenCalledWith('configState.tooltip.module');
    });
});
