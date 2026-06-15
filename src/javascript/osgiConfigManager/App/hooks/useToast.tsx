import React, { useState, useCallback, createContext, useContext, ReactNode, useRef, useEffect } from 'react';
import { Paper, Typography, Check, Warning, Information, Button, Close } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';

interface ToastMessage {
    message: string;
    type?: 'success' | 'warning' | 'error' | 'info';
    duration?: number;
}

interface ToastContextType {
    notify: (msg: string, type?: 'success' | 'warning' | 'error' | 'info', duration?: number) => void;
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const dismiss = useCallback(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setToast(null);
    }, []);

    const notify = useCallback((message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info', duration = 6000) => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }

        setToast({ message, type, duration });

        timeoutRef.current = window.setTimeout(() => {
            setToast(null);
            timeoutRef.current = null;
        }, duration);
    }, []);

    const success = useCallback((msg: string) => notify(msg, 'success'), [notify]);
    const error = useCallback((msg: string) => notify(msg, 'error'), [notify]);
    const warning = useCallback((msg: string) => notify(msg, 'warning'), [notify]);

    useEffect(() => () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
    }, []);

    const getToastMeta = (type: ToastMessage['type']) => {
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

    const toastMeta = toast ? getToastMeta(toast.type) : null;

    return (
        <ToastContext.Provider value={{ notify, success, error, warning }}>
            {children}
            {toast && (
                <Paper
                    data-cy="toast-message"
                    role={toast.type === 'error' ? 'alert' : 'status'}
                    aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
                    aria-atomic="true"
                    style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    borderLeft: `4px solid ${toastMeta?.borderColor}`,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    zIndex: 10000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '280px',
                    maxWidth: '520px'
                }}
                >
                    {toastMeta?.icon}
                    <Typography style={{ flex: 1 }}>{toast.message}</Typography>
                    <Button
                        variant="ghost"
                        size="small"
                        icon={<Close />}
                        onClick={dismiss}
                        aria-label={t('notification.dismiss')}
                        data-cy="toast-dismiss"
                    />
                </Paper>
            )}
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
