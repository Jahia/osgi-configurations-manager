import React from 'react';
import {render, screen, act} from '@testing-library/react';
import {ToastProvider, useToast} from './useToast';

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
