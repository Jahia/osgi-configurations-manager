import React, { useState, useCallback, createContext, useContext, ReactNode, useRef, useEffect } from 'react';
import { Button, Close, Typography, Check, Warning, Information } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    notify: (msg: string, type?: ToastType, duration?: number | null) => void;
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// An error or a warning is often the only report of a failed save, delete or import: it stays until
// it is closed or replaced (WCAG 2.2.1). Other toasts leave on their own, after a time that grows
// with the length of the message.
const autoDismissDelay = (message: string, type: ToastType): number | null => {
    if (type === 'error' || type === 'warning') {
        return null;
    }
    return Math.min(20000, Math.max(8000, 4000 + message.length * 60));
};

const HOST_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '8px 4px 8px 12px',
    borderRadius: '6px',
    zIndex: 10000,
    background: 'var(--color-white)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    // No gap: the region that does not hold the message stays an empty flex item.
    minWidth: '280px',
    maxWidth: '520px'
};

const getToastMeta = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                icon: <Check size="small" style={{ color: 'var(--color-success)' }} />,
                borderColor: 'var(--color-success)'
            };
        case 'warning':
            return {
                icon: <Warning size="small" style={{ color: 'var(--color-warning)' }} />,
                borderColor: 'var(--color-warning)'
            };
        case 'error':
            return {
                icon: <Warning size="small" style={{ color: 'var(--color-danger)' }} />,
                borderColor: 'var(--color-danger)'
            };
        default:
            return {
                icon: <Information size="small" style={{ color: 'var(--color-accent)' }} />,
                borderColor: 'var(--color-accent)'
            };
    }
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const idRef = useRef(0);
    const hostRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);
    // While the pointer or the focus is on the toast its timer stops, and restarts with what was left.
    const deadlineRef = useRef<number | null>(null);
    const remainingRef = useRef<number | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const clearTimer = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const startTimer = useCallback((delay: number) => {
        clearTimer();
        deadlineRef.current = Date.now() + delay;
        timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            deadlineRef.current = null;
            setToast(null);
        }, delay);
    }, []);

    const notify = useCallback((message: string, type: ToastType = 'info', duration?: number | null) => {
        clearTimer();
        deadlineRef.current = null;
        remainingRef.current = null;
        idRef.current += 1;
        setToast({ id: idRef.current, message, type });

        const delay = duration === undefined ? autoDismissDelay(message, type) : duration;
        if (delay !== null) {
            const host = hostRef.current;
            if (host && (host.matches(':hover') || host.contains(document.activeElement))) {
                remainingRef.current = delay;
            } else {
                startTimer(delay);
            }
        }
    }, [startTimer]);

    const success = useCallback((msg: string) => notify(msg, 'success'), [notify]);
    const error = useCallback((msg: string) => notify(msg, 'error'), [notify]);
    const warning = useCallback((msg: string) => notify(msg, 'warning'), [notify]);

    const dismiss = useCallback(() => {
        clearTimer();
        deadlineRef.current = null;
        remainingRef.current = null;
        // The close button is about to disappear: give the focus back rather than drop it to <body>.
        const host = hostRef.current;
        if (host && host.contains(document.activeElement)) {
            const previous = returnFocusRef.current;
            if (previous && previous.isConnected) {
                previous.focus();
            } else {
                (document.activeElement as HTMLElement | null)?.blur();
            }
        }
        returnFocusRef.current = null;
        setToast(null);
    }, []);

    const pause = () => {
        if (timeoutRef.current && deadlineRef.current !== null) {
            remainingRef.current = Math.max(deadlineRef.current - Date.now(), 0);
            clearTimer();
            deadlineRef.current = null;
        }
    };

    const resume = () => {
        const host = hostRef.current;
        if (remainingRef.current === null || !host || host.matches(':hover') || host.contains(document.activeElement)) {
            return;
        }
        const remaining = Math.max(remainingRef.current, 2000);
        remainingRef.current = null;
        startTimer(remaining);
    };

    useEffect(() => () => clearTimer(), []);

    const toastMeta = toast ? getToastMeta(toast.type) : null;
    const message = (type: 'error' | 'other') => toast && (toast.type === 'error') === (type === 'error') && (
        // Keyed by toast: the same text twice in a row is a new node, so it is announced again.
        <Typography key={toast.id} data-cy="toast-message">{toast.message}</Typography>
    );

    // The toast is the only feedback for save, delete, create, import and toggle. Screen readers
    // announce a change inside a live region that already exists, not a region mounted together
    // with its text (WCAG 4.1.3), so both regions stay mounted and only their content changes.
    // Errors go to the assertive one. The close button sits outside both, so that it is not read
    // as part of the message.
    return (
        <ToastContext.Provider value={{ notify, success, error, warning }}>
            {children}
            <div
                ref={hostRef}
                data-cy="toast-host"
                data-live-host=""
                style={toast ? { ...HOST_STYLE, borderLeft: `4px solid ${toastMeta?.borderColor}` } : undefined}
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
                    if (event.key === 'Escape' && toast) {
                        event.stopPropagation();
                        dismiss();
                    }
                }}
            >
                {toast && <span aria-hidden="true" style={{ display: 'flex', marginRight: '8px' }}>{toastMeta?.icon}</span>}
                <div data-cy="toast-status-region" role="status" aria-live="polite" aria-atomic="true" style={toast && toast.type !== 'error' ? { flex: 1 } : undefined}>
                    {message('other')}
                </div>
                <div data-cy="toast-alert-region" role="alert" aria-atomic="true" style={toast?.type === 'error' ? { flex: 1 } : undefined}>
                    {message('error')}
                </div>
                {toast && (
                    <Button
                        data-cy="toast-dismiss"
                        variant="ghost"
                        size="small"
                        icon={<Close />}
                        aria-label={t('notification.dismiss')}
                        style={{ marginLeft: '4px', flexShrink: 0 }}
                        onClick={dismiss}
                    />
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
