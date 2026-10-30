import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

// Live regions stay out of inert: a message announced while a dialog is open (an error toast)
// would otherwise be silent.
const LIVE_REGION_SELECTOR = '[role="status"], [role="alert"], [aria-live]';

/**
 * Makes everything outside the dialog inert, so neither Tab nor a screen reader's own navigation
 * can reach the page behind it: walking up from the dialog, every sibling of each ancestor. Returns
 * the elements it changed, so only those are restored.
 */
const makeOutsideInert = (dialog: HTMLElement): HTMLElement[] => {
    const changed: HTMLElement[] = [];
    let node: HTMLElement | null = dialog;
    while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) {
            break;
        }
        Array.from(parent.children).forEach(sibling => {
            const element = sibling as HTMLElement;
            if (element !== node && !element.hasAttribute('inert') && !element.matches(LIVE_REGION_SELECTOR)
                && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)) {
                element.setAttribute('inert', '');
                changed.push(element);
            }
        });
        node = parent;
    }
    return changed;
};

/**
 * Accessibility behaviour shared by the module's own modal dialogs:
 * - makes the page behind the dialog inert while it is open,
 * - moves focus into the dialog when it opens: the element marked data-autofocus, else the first
 *   focusable element, else the container,
 * - keeps Tab / Shift+Tab within the dialog, also when the focus was somewhere unexpected,
 * - closes on Escape,
 * - gives the focus back to the element that had it before the dialog opened.
 *
 * Attach the returned ref to the element that contains the dialog's focusable controls. Mark the
 * field to focus with data-autofocus rather than autoFocus: autoFocus moves the focus before this
 * hook runs, so the hook recorded the field, not the button that opened the dialog, and the focus
 * fell to <body> on close.
 */
export const useDialogA11y = (isOpen: boolean, onClose: () => void): RefObject<HTMLDivElement> => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    // Read through a ref: callers pass inline arrows, and depending on onClose re-ran the effect at
    // every parent render, moving the focus back to the first field (e.g. when a toast appeared).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

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

        const container = containerRef.current;
        const dialog = (container?.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement | null) || container;
        const inertElements = dialog ? makeOutsideInert(dialog) : [];

        const initial = container?.querySelector<HTMLElement>('[data-autofocus]');
        const focusables = getFocusable();
        if (initial) {
            initial.focus();
        } else if (focusables.length > 0) {
            focusables[0].focus();
        } else if (container) {
            // Ensure the container can actually receive programmatic focus when it holds no
            // focusable children, so focus does not silently stay outside the dialog.
            if (!container.hasAttribute('tabindex')) {
                container.setAttribute('tabindex', '-1');
            }
            container.focus();
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseRef.current();
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
            const inside = Boolean(containerRef.current && active && containerRef.current.contains(active));

            if (!inside) {
                // The focus was on the dialog's text or backdrop: bring it back in.
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (event.shiftKey && active === first) {
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
            inertElements.forEach(element => element.removeAttribute('inert'));
            const previous = previouslyFocusedRef.current;
            if (previous && previous.isConnected && typeof previous.focus === 'function') {
                previous.focus();
            }
        };
    }, [isOpen]);

    return containerRef;
};
