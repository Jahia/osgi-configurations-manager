import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Accessibility behaviour shared by modal dialogs:
 * - moves focus into the dialog when it opens (first focusable element, else the container),
 * - traps Tab / Shift+Tab within the dialog,
 * - closes on Escape,
 * - restores focus to the previously focused element when the dialog closes.
 *
 * Attach the returned ref to the element that contains the dialog's focusable controls.
 */
export const useDialogA11y = (isOpen: boolean, onClose: () => void): RefObject<HTMLDivElement> => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

        const getFocusable = (): HTMLElement[] => {
            const container = containerRef.current;
            if (!container) {
                return [];
            }
            return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
                .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
        };

        const focusables = getFocusable();
        if (focusables.length > 0) {
            focusables[0].focus();
        } else if (containerRef.current) {
            // Ensure the container can actually receive programmatic focus when it holds no
            // focusable children, so focus does not silently stay outside the dialog.
            if (!containerRef.current.hasAttribute('tabindex')) {
                containerRef.current.setAttribute('tabindex', '-1');
            }
            containerRef.current.focus();
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== 'Tab') {
                return;
            }

            const items = getFocusable();
            if (items.length === 0) {
                event.preventDefault();
                return;
            }

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            const previous = previouslyFocusedRef.current;
            if (previous && typeof previous.focus === 'function') {
                previous.focus();
            }
        };
    }, [isOpen, onClose]);

    return containerRef;
};
