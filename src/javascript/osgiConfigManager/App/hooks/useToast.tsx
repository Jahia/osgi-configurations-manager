import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { Typography } from '@jahia/moonstone';

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
    const [toast, setToast] = useState<ToastMessage | null>(null);

    const notify = useCallback((message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info', duration = 6000) => {
        setToast({ message, type, duration });
        setTimeout(() => setToast(null), duration);
    }, []);

    const success = useCallback((msg: string) => notify(msg, 'success'), [notify]);
    const error = useCallback((msg: string) => notify(msg, 'error'), [notify]);
    const warning = useCallback((msg: string) => notify(msg, 'warning'), [notify]);

    return (
        <ToastContext.Provider value={{ notify, success, error, warning }}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: toast.type === 'success' ? '#13bd76' : toast.type === 'error' ? '#e0182d' : '#333',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '4px',
                    zIndex: 10000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'fadeIn 0.3s ease-in-out'
                }}>
                    <Typography style={{ color: '#fff' }}>{toast.message}</Typography>
                </div>
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
