import React from 'react';
import {render, screen, act, fireEvent, within, configure} from '@testing-library/react';
import {ToastProvider, useToast, MAX_TOASTS} from './useToast';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: (key: string) => key})
}));

let api: ReturnType<typeof useToast>;
const Capture = () => {
    api = useToast();
    return null;
};

const statusRegion = () => screen.getByTestId('toast-status-region');
const alertRegion = () => screen.getByTestId('toast-alert-region');
const cards = () => screen.queryAllByTestId('toast-card');

const renderProvider = (children: React.ReactNode = null) => render(
    <ToastProvider><Capture/>{children}</ToastProvider>
);

// data-cy, as the Cypress specs use it.
configure({testIdAttribute: 'data-cy'});

describe('ToastProvider announcements', () => {
    // A live region mounted together with its text is not announced: both must exist beforehand.
    it('keeps an empty status and alert region mounted before any notification', () => {
        renderProvider();

        expect(statusRegion().getAttribute('role')).toBe('status');
        expect(statusRegion().textContent).toBe('');
        expect(alertRegion().getAttribute('role')).toBe('alert');
        expect(alertRegion().textContent).toBe('');
    });

    // Floating UI hides everything outside an open Moonstone dialog but [aria-live]: a bare
    // role="alert" was hidden with the rest, and an error fired as a dialog opened was silent.
    it('declares aria-live on both regions', () => {
        renderProvider();

        expect(statusRegion().getAttribute('aria-live')).toBe('polite');
        expect(alertRegion().getAttribute('aria-live')).toBe('assertive');
    });

    it('announces a success politely and an error assertively, with its kind in words', () => {
        renderProvider();

        act(() => api.success('Saved a.cfg'));
        expect(statusRegion().textContent).toBe('Saved a.cfg');
        expect(alertRegion().textContent).toBe('');

        act(() => api.error('Error saving a.cfg'));
        expect(alertRegion().textContent).toBe('banner.prefix.error Error saving a.cfg');

        act(() => api.warning('2 values not decrypted'));
        expect(statusRegion().textContent).toContain('banner.prefix.warning 2 values not decrypted');
    });

    // A second message replaced the first before it was read (a save, then the reload's warning).
    it('appends a message rather than replacing the one before it', () => {
        renderProvider();

        act(() => api.success('Saved a.cfg'));
        act(() => api.warning('2 values not decrypted'));

        expect(statusRegion().textContent).toContain('Saved a.cfg');
        expect(statusRegion().textContent).toContain('2 values not decrypted');
    });

    it('renders a repeated message as a new node, so that it is announced again', () => {
        renderProvider();

        act(() => api.success('Saved a.cfg'));
        const first = within(statusRegion()).getByText('Saved a.cfg');
        act(() => api.success('Saved a.cfg'));

        const nodes = within(statusRegion()).getAllByText('Saved a.cfg');
        expect(nodes).toHaveLength(2);
        expect(nodes[1]).not.toBe(first);
    });

    it('keeps the cards themselves out of the live regions', () => {
        renderProvider();

        act(() => api.error('Error saving a.cfg'));
        const card = cards()[0];

        expect(statusRegion().contains(card)).toBe(false);
        expect(alertRegion().contains(card)).toBe(false);
        expect(card.closest('[aria-live]')).toBeNull();
    });
});

describe('ToastProvider cards', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // An error vanished after 6 s, although it was the only report of a failed save (WCAG 2.2.1).
    it('keeps an error until it is closed, and lets a success leave on its own', () => {
        renderProvider();

        act(() => api.error('Error saving a.cfg'));
        act(() => api.success('Saved b.cfg'));
        act(() => {
            jest.advanceTimersByTime(60000);
        });

        expect(cards()).toHaveLength(1);
        expect(cards()[0].textContent).toContain('Error saving a.cfg');
    });

    // The announcement leaves; the card stays as the copy to read again.
    it('clears an announcement after a few seconds, but not its card', () => {
        renderProvider();

        act(() => api.error('Error saving a.cfg'));
        act(() => {
            jest.advanceTimersByTime(8000);
        });

        expect(alertRegion().textContent).toBe('');
        expect(cards()).toHaveLength(1);
    });

    it('shows each kind with its words and an icon of its own', () => {
        renderProvider();

        act(() => api.error('E'));
        act(() => api.warning('W'));
        const [error, warning] = cards();

        expect(error.textContent).toContain('banner.prefix.error');
        expect(warning.textContent).toContain('banner.prefix.warning');
        expect(error.querySelector('svg')?.innerHTML).not.toBe(warning.querySelector('svg')?.innerHTML);
        expect(error.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('keeps the last notifications, an error before an older success', () => {
        renderProvider();

        act(() => api.error('kept error'));
        for (let i = 1; i <= MAX_TOASTS; i++) {
            act(() => api.success(`success ${i}`));
        }

        const texts = cards().map(card => card.textContent);
        expect(texts).toHaveLength(MAX_TOASTS);
        expect(texts[0]).toContain('kept error');
        expect(texts.join(' ')).not.toContain('success 1');
    });

    it('closes with its own button, which is not read as part of the message', () => {
        renderProvider();

        act(() => api.error('Error saving a.cfg'));
        const close = within(cards()[0]).getByRole('button', {name: 'notification.dismiss'});
        expect(alertRegion().contains(close)).toBe(false);

        fireEvent.click(close);
        expect(cards()).toHaveLength(0);
        expect(alertRegion().textContent).toBe('');
    });

    it('stops the timers while the pointer is on the notifications', () => {
        renderProvider();

        act(() => api.success('Saved a.cfg'));
        fireEvent.mouseEnter(screen.getByTestId('toast-host'));
        act(() => {
            jest.advanceTimersByTime(60000);
        });

        expect(cards()).toHaveLength(1);
    });
});

describe('ToastProvider focus', () => {
    // With a stack, a closed card dropped the focus to the page, far from the other cards.
    it('hands the focus to the next card when one is closed, and back to the page with the last', () => {
        renderProvider(<button type="button">opener</button>);
        const opener = screen.getByRole('button', {name: 'opener'});

        act(() => api.error('first'));
        act(() => api.error('second'));
        opener.focus();
        const [first, second] = cards().map(card => within(card).getByRole('button', {name: 'notification.dismiss'}));
        act(() => first.focus());

        fireEvent.click(first);
        expect(document.activeElement).toBe(second);

        fireEvent.click(second);
        expect(document.activeElement).toBe(opener);
    });

    it('closes the focused card on Escape', () => {
        renderProvider();

        act(() => api.error('first'));
        act(() => api.error('second'));
        const secondClose = within(cards()[1]).getByRole('button', {name: 'notification.dismiss'});
        act(() => secondClose.focus());

        fireEvent.keyDown(secondClose, {key: 'Escape'});

        expect(cards()).toHaveLength(1);
        expect(cards()[0].textContent).toContain('first');
    });

    // WCAG 2.4.11: the stack covered the controls at the bottom right of the editor.
    it('moves away from the corner where it would cover the focused element', () => {
        renderProvider(<button type="button">bottom right control</button>);
        const control = screen.getByRole('button', {name: 'bottom right control'});
        const rect = (left: number, top: number, width: number, height: number) => ({
            left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({})
        }) as DOMRect;
        control.getBoundingClientRect = () => rect(window.innerWidth - 120, window.innerHeight - 60, 100, 32);
        const original = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function () {
            return this.getAttribute('data-cy') === 'toast-stack' ? rect(0, 0, 300, 60) : original.call(this);
        };

        try {
            control.focus();
            act(() => api.error('Error saving a.cfg'));
            expect(screen.getByTestId('toast-stack').getAttribute('data-corner')).toBe('bottom-left');
        } finally {
            HTMLElement.prototype.getBoundingClientRect = original;
        }
    });
});
