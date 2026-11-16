import React, { useState, useCallback, createContext, useContext, ReactNode, useRef, useEffect, useLayoutEffect } from 'react';
import { Button, Close, Typography, Check } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { SEVERITY_STYLES, VISUALLY_HIDDEN_STYLE as HIDDEN } from '../components/AppChrome';

// AppChrome is JavaScript: its style object is typed as plain strings.
const VISUALLY_HIDDEN_STYLE = HIDDEN as React.CSSProperties;

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

interface Announcement {
    id: number;
    toastId: number;
    text: string;
    assertive: boolean;
}

type Corner = 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';

interface ToastContextType {
    notify: (msg: string, type?: ToastType, duration?: number | null) => void;
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Several notifications can follow one action (a save, then the warning about values its reload
// could not decrypt): each used to replace the previous one. A few stay on screen together.
export const MAX_TOASTS = 3;
// An announcement leaves its live region after this long: the card stays as the copy to re-read,
// and a persistent error would otherwise be read twice in browse mode.
const ANNOUNCEMENT_LIFETIME_MS = 7000;
const EDGE = 20;
// The stack leaves a focused element's ring clear too.
const RING_MARGIN = 4;
const CORNERS: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];

// An error or a warning is often the only report of a failed save, delete or import: it stays until
// it is closed (WCAG 2.2.1). Other notifications leave on their own, after a time that grows with
// the length of the message.
const autoDismissDelay = (message: string, type: ToastType): number | null => {
    if (type === 'error' || type === 'warning') {
        return null;
    }
    return Math.min(20000, Math.max(8000, 4000 + message.length * 60));
};

const isPersistent = (toast: ToastMessage) => toast.type === 'error' || toast.type === 'warning';

const cornerStyle = (corner: Corner): React.CSSProperties => {
    const [vertical, horizontal] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
    return {
        [vertical]: `${EDGE}px`,
        [horizontal]: `${EDGE}px`,
        flexDirection: vertical === 'bottom' ? 'column' : 'column-reverse',
        alignItems: horizontal === 'right' ? 'flex-end' : 'flex-start'
    };
};

const STACK_STYLE: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    display: 'flex',
    gap: '8px',
    maxWidth: `calc(100vw - ${2 * EDGE}px)`
};

const CARD_STYLE: React.CSSProperties = {
    padding: '8px 4px 8px 12px',
    borderRadius: '6px',
    background: 'var(--color-white)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    // Transparent, so that forced colours, which drop the shadow, draw an edge.
    border: '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '280px',
    maxWidth: '520px',
    boxSizing: 'border-box'
};

const severityOf = (type: ToastType) => SEVERITY_STYLES[type] || SEVERITY_STYLES.info;

const ToastIcon = ({ type }: { type: ToastType }) => {
    const Icon = severityOf(type).icon || Check;
    // Decorative: the message says which kind it is, in words, for screen readers.
    return <Icon size="small" aria-hidden="true" focusable="false" style={{ color: severityOf(type).color, flexShrink: 0 }} />;
};

const intersects = (a: DOMRect | { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
);

const overlapArea = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => (
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
);

// Where the stack would be in a corner, at its current size.
const rectAt = (corner: Corner, width: number, height: number) => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const left = corner.endsWith('right') ? viewportWidth - EDGE - width : EDGE;
    const top = corner.startsWith('bottom') ? viewportHeight - EDGE - height : EDGE;
    return { left, top, right: left + width, bottom: top + height };
};

// The element whose focus the user sees: the option a listbox points to rather than the listbox.
const visibleFocusTarget = (active: Element | null): Element | null => {
    if (!active || active === document.body) {
        return null;
    }
    const descendantId = active.getAttribute('aria-activedescendant');
    return (descendantId && document.getElementById(descendantId)) || active;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [corner, setCorner] = useState<Corner>('bottom-right');
    const toastsRef = useRef<ToastMessage[]>([]);
    const idRef = useRef(0);
    const hostRef = useRef<HTMLDivElement>(null);
    const stackRef = useRef<HTMLDivElement>(null);
    // One timer per notification. While the pointer or the focus is in the stack, all of them stop,
    // and restart with what each had left.
    const timersRef = useRef(new Map<number, { timeout: number | null; deadline: number | null; remaining: number | null }>());
    const pausedRef = useRef(false);
    const announcementTimersRef = useRef(new Set<number>());
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const placementFrameRef = useRef<number | null>(null);

    const prefixFor = useCallback((type: ToastType) => (type === 'success' ? '' : t(`banner.prefix.${type}`)), [t]);

    const commit = (next: ToastMessage[]) => {
        toastsRef.current = next;
        setToasts(next);
    };

    const removeToast = useCallback((id: number) => {
        const timer = timersRef.current.get(id);
        if (timer?.timeout) {
            window.clearTimeout(timer.timeout);
        }
        timersRef.current.delete(id);
        commit(toastsRef.current.filter(toast => toast.id !== id));
        setAnnouncements(previous => previous.filter(announcement => announcement.toastId !== id));
    }, []);

    const startTimer = useCallback((id: number, delay: number) => {
        const timeout = window.setTimeout(() => removeToast(id), delay);
        timersRef.current.set(id, { timeout, deadline: Date.now() + delay, remaining: null });
    }, [removeToast]);

    const focusInsideStack = () => Boolean(hostRef.current && hostRef.current.contains(document.activeElement));

    const notify = useCallback((message: string, type: ToastType = 'info', duration?: number | null) => {
        idRef.current += 1;
        const toast: ToastMessage = { id: idRef.current, message, type };
        let next = [...toastsRef.current, toast];

        // Over the limit, the oldest goes, but not the one holding the focus, and an error or a
        // warning only when nothing else can.
        while (next.length > MAX_TOASTS) {
            const focusedCard = document.activeElement?.closest?.('[data-toast-id]');
            const focusedId = focusedCard ? Number(focusedCard.getAttribute('data-toast-id')) : null;
            const candidates = next.filter(item => item.id !== toast.id && item.id !== focusedId);
            const evicted = candidates.find(item => !isPersistent(item)) || candidates[0] || next[0];
            const timer = timersRef.current.get(evicted.id);
            if (timer?.timeout) {
                window.clearTimeout(timer.timeout);
            }
            timersRef.current.delete(evicted.id);
            next = next.filter(item => item.id !== evicted.id);
            setAnnouncements(previous => previous.filter(announcement => announcement.toastId !== evicted.id));
        }
        commit(next);

        // Appended, never replaced: a message is not cut by the next one, and the same text twice is
        // a new node, so it is announced again.
        const prefix = type === 'success' ? '' : t(`banner.prefix.${type}`);
        const announcement: Announcement = { id: toast.id, toastId: toast.id, text: prefix ? `${prefix} ${message}` : message, assertive: type === 'error' };
        setAnnouncements(previous => [...previous, announcement]);
        const announcementTimer = window.setTimeout(() => {
            announcementTimersRef.current.delete(announcementTimer);
            setAnnouncements(previous => previous.filter(item => item.id !== announcement.id));
        }, ANNOUNCEMENT_LIFETIME_MS);
        announcementTimersRef.current.add(announcementTimer);

        const delay = duration === undefined ? autoDismissDelay(message, type) : duration;
        if (delay !== null) {
            if (pausedRef.current) {
                timersRef.current.set(toast.id, { timeout: null, deadline: null, remaining: delay });
            } else {
                startTimer(toast.id, delay);
            }
        }
    }, [startTimer, t]);

    const success = useCallback((msg: string) => notify(msg, 'success'), [notify]);
    const error = useCallback((msg: string) => notify(msg, 'error'), [notify]);
    const warning = useCallback((msg: string) => notify(msg, 'warning'), [notify]);

    // A closed card hands the focus to the card that takes its place, else to the one before it, and
    // only with the last card back to where the focus came from.
    const dismiss = useCallback((id: number) => {
        const host = hostRef.current;
        const card = host?.querySelector(`[data-toast-id="${id}"]`);
        if (card && card.contains(document.activeElement)) {
            const cards = Array.from(host!.querySelectorAll('[data-toast-id]'));
            const index = cards.indexOf(card);
            const neighbour = cards[index + 1] || cards[index - 1];
            const neighbourButton = neighbour?.querySelector('button') as HTMLElement | null;
            if (neighbourButton) {
                neighbourButton.focus();
            } else {
                const previous = returnFocusRef.current;
                returnFocusRef.current = null;
                if (previous && previous.isConnected) {
                    previous.focus();
                } else {
                    (document.activeElement as HTMLElement | null)?.blur();
                }
            }
        }
        removeToast(id);
    }, [removeToast]);

    const pause = () => {
        pausedRef.current = true;
        timersRef.current.forEach((timer, id) => {
            if (timer.timeout && timer.deadline !== null) {
                window.clearTimeout(timer.timeout);
                timersRef.current.set(id, { timeout: null, deadline: null, remaining: Math.max(timer.deadline - Date.now(), 0) });
            }
        });
    };

    const resume = () => {
        const host = hostRef.current;
        if (!host || host.matches(':hover') || focusInsideStack()) {
            return;
        }
        pausedRef.current = false;
        timersRef.current.forEach((timer, id) => {
            if (timer.remaining !== null) {
                startTimer(id, Math.max(timer.remaining, 2000));
            }
        });
    };

    // WCAG 2.4.11: the stack must not hide the focused element. It takes the first corner where it
    // clears the element's ring, else the one where it covers the least. Not while the focus is in
    // the stack itself, which would move it from under the pointer.
    const updatePlacement = useCallback(() => {
        placementFrameRef.current = null;
        const stack = stackRef.current;
        if (!stack || toastsRef.current.length === 0 || focusInsideStack()) {
            return;
        }
        const target = visibleFocusTarget(document.activeElement);
        if (!target) {
            setCorner('bottom-right');
            return;
        }
        const { width, height } = stack.getBoundingClientRect();
        const focused = target.getBoundingClientRect();
        const ring = { left: focused.left - RING_MARGIN, top: focused.top - RING_MARGIN, right: focused.right + RING_MARGIN, bottom: focused.bottom + RING_MARGIN };
        const free = CORNERS.find(candidate => !intersects(rectAt(candidate, width, height), ring));
        if (free) {
            setCorner(free);
            return;
        }
        const leastCovering = CORNERS.reduce((best, candidate) => (
            overlapArea(rectAt(candidate, width, height), ring) < overlapArea(rectAt(best, width, height), ring) ? candidate : best
        ));
        setCorner(leastCovering);
    }, []);

    const schedulePlacement = useCallback(() => {
        if (placementFrameRef.current === null) {
            placementFrameRef.current = window.requestAnimationFrame(updatePlacement);
        }
    }, [updatePlacement]);

    const hasToasts = toasts.length > 0;
    useEffect(() => {
        if (!hasToasts) {
            setCorner('bottom-right');
            return undefined;
        }
        // The focus can move without a focusin: a listbox's active option, the editor's caret, a
        // scrolled field.
        const events: Array<[EventTarget, string]> = [[document, 'focusin'], [document, 'keyup'], [document, 'scroll'], [window, 'resize']];
        events.forEach(([target, type]) => target.addEventListener(type, schedulePlacement, true));
        return () => events.forEach(([target, type]) => target.removeEventListener(type, schedulePlacement, true));
    }, [hasToasts, schedulePlacement]);

    // A new card changes the stack's size.
    useLayoutEffect(() => {
        if (hasToasts) {
            updatePlacement();
        }
    }, [toasts, hasToasts, updatePlacement]);

    useEffect(() => () => {
        timersRef.current.forEach(timer => timer.timeout && window.clearTimeout(timer.timeout));
        announcementTimersRef.current.forEach(timer => window.clearTimeout(timer));
        if (placementFrameRef.current !== null) {
            window.cancelAnimationFrame(placementFrameRef.current);
        }
    }, []);

    const announcementsOf = (assertive: boolean) => announcements
        .filter(announcement => announcement.assertive === assertive)
        .map(announcement => <div key={announcement.id}>{announcement.text}</div>);

    // The cards are not live: screen readers announce a change inside a live region that already
    // exists, not one mounted together with its text (WCAG 4.1.3), so the announcements go to two
    // regions that stay mounted, errors to the assertive one. Explicit aria-live on both: inside an
    // open Moonstone dialog, Floating UI hides everything else but [aria-live], and a bare
    // role="alert" was hidden with the rest. data-live-host keeps the module's own dialogs from
    // making the stack inert.
    return (
        <ToastContext.Provider value={{ notify, success, error, warning }}>
            {children}
            <div
                ref={hostRef}
                data-cy="toast-host"
                data-live-host=""
                onMouseEnter={pause}
                onMouseLeave={resume}
                onFocus={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        returnFocusRef.current = event.relatedTarget as HTMLElement | null;
                    }
                    pause();
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        window.setTimeout(resume, 0);
                    }
                }}
                onKeyDown={event => {
                    const card = (event.target as Element).closest?.('[data-toast-id]');
                    if (event.key === 'Escape' && card) {
                        event.stopPropagation();
                        dismiss(Number(card.getAttribute('data-toast-id')));
                    }
                }}
            >
                <div data-cy="toast-status-region" role="status" aria-live="polite" aria-atomic="false" style={VISUALLY_HIDDEN_STYLE}>
                    {announcementsOf(false)}
                </div>
                <div data-cy="toast-alert-region" role="alert" aria-live="assertive" aria-atomic="false" style={VISUALLY_HIDDEN_STYLE}>
                    {announcementsOf(true)}
                </div>
                {hasToasts && (
                    <div
                        ref={stackRef}
                        data-cy="toast-stack"
                        data-corner={corner}
                        role="region"
                        aria-label={t('notification.region')}
                        style={{ ...STACK_STYLE, ...cornerStyle(corner) }}
                    >
                        {toasts.map(toast => (
                            <div
                                key={toast.id}
                                data-cy="toast-card"
                                data-toast-id={toast.id}
                                data-type={toast.type}
                                style={{ ...CARD_STYLE, borderLeft: `4px solid ${severityOf(toast.type).color}` }}
                            >
                                <ToastIcon type={toast.type}/>
                                <Typography data-cy="toast-message" style={{ flex: 1 }}>
                                    {prefixFor(toast.type) && <span style={VISUALLY_HIDDEN_STYLE}>{prefixFor(toast.type)} </span>}
                                    {toast.message}
                                </Typography>
                                <Button
                                    data-cy="toast-dismiss"
                                    variant="ghost"
                                    size="small"
                                    icon={<Close />}
                                    aria-label={t('notification.dismiss')}
                                    style={{ flexShrink: 0 }}
                                    onClick={() => dismiss(toast.id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
