import React from 'react';
import {render, screen, act, fireEvent} from '@testing-library/react';
import {ToastProvider, useToast} from './useToast';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: (key: string) => key})
}));

let api: ReturnType<typeof useToast>;
const Capture = () => {
    api = useToast();
    return null;
};

describe('ToastProvider live regions', () => {
    // A live region mounted together with its text is not announced: both must exist beforehand.
    it('keeps an empty status and alert region mounted before any toast', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        expect(screen.getByRole('status').textContent).toBe('');
        expect(screen.getByRole('alert').textContent).toBe('');
    });

    it('puts a success in the polite region and an error in the alert region', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        act(() => api.success('Saved a.cfg'));
        expect(screen.getByRole('status').textContent).toContain('Saved a.cfg');
        expect(screen.getByRole('alert').textContent).toBe('');

        act(() => api.error('Error saving a.cfg'));
        expect(screen.getByRole('alert').textContent).toContain('Error saving a.cfg');
        expect(screen.getByRole('status').textContent).toBe('');
    });
});

describe('ToastProvider timing and dismissal', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // An error vanished after 6 s, although it was the only report of a failed save (WCAG 2.2.1).
    it('keeps an error until it is closed, and lets a success leave on its own', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        act(() => api.error('Error saving a.cfg'));
        act(() => {
            jest.advanceTimersByTime(60000);
        });
        expect(screen.getByRole('alert').textContent).toContain('Error saving a.cfg');

        act(() => api.success('Saved a.cfg'));
        act(() => {
            jest.advanceTimersByTime(20000);
        });
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('closes with its button, which is not read as part of the message', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        act(() => api.error('Error saving a.cfg'));
        const close = screen.getByRole('button', {name: 'notification.dismiss'});
        expect(screen.getByRole('alert').contains(close)).toBe(false);

        fireEvent.click(close);
        expect(screen.getByRole('alert').textContent).toBe('');
        expect(screen.queryByRole('button', {name: 'notification.dismiss'})).toBeNull();
    });

    it('stops its timer while the pointer is on it', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        act(() => api.success('Saved a.cfg'));
        fireEvent.mouseEnter(screen.getByRole('status').parentElement as HTMLElement);
        act(() => {
            jest.advanceTimersByTime(60000);
        });
        expect(screen.getByRole('status').textContent).toContain('Saved a.cfg');
    });

    // The same text twice was the same node: the second toast was not announced.
    it('renders a repeated message as a new node', () => {
        render(<ToastProvider><Capture/></ToastProvider>);

        act(() => api.success('Saved a.cfg'));
        const first = screen.getByText('Saved a.cfg');
        act(() => api.success('Saved a.cfg'));
        expect(screen.getByText('Saved a.cfg')).not.toBe(first);
    });
});
