import React, { useMemo } from 'react';
import { Button, Typography, Paper, Close } from '@jahia/moonstone';
import { diffLines, Change } from 'diff';
import { useTranslation } from 'react-i18next';

interface DiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    originalContent: string;
    newContent: string;
    filename: string;
}

export const DiffModal: React.FC<DiffModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    originalContent,
    newContent,
    filename
}) => {
    const { t } = useTranslation('osgi-configurations-manager');

    const changes = useMemo(() => {
        if (!originalContent && !newContent) return [];
        return diffLines(originalContent || '', newContent || '');
    }, [originalContent, newContent]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(20, 25, 30, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s ease'
        }} onClick={onClose}>
            <Paper
                style={{
                    width: '900px',
                    maxWidth: '90%',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#fff',
                    animation: 'modalSlideIn 0.3s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 28px',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Typography variant="heading" weight="bold" style={{ fontSize: '18px', color: '#111' }}>
                        {t('modal.diff.title', { name: filename }) || `Changes: ${filename}`}
                    </Typography>
                    <div style={{ cursor: 'pointer', color: '#888', transition: 'color 0.2s' }}
                        onClick={onClose}
                        onMouseOver={e => e.currentTarget.style.color = '#333'}
                        onMouseOut={e => e.currentTarget.style.color = '#888'}>
                        <Close />
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        backgroundColor: '#f5f5f5',
                        padding: '16px',
                        borderRadius: '4px',
                        maxHeight: '60vh',
                        overflowY: 'auto',
                        border: '1px solid #e0e0e0',
                        fontSize: '13px',
                        lineHeight: '1.5'
                    }}>
                        {changes.map((part: Change, index: number) => {
                            const style: React.CSSProperties = {
                                backgroundColor: part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent',
                                color: part.added ? '#1e7e34' : part.removed ? '#cb2431' : '#333',
                                display: 'block',
                                textDecoration: 'none'
                            };

                            // diffLines returns parts that end with newline usually
                            return (
                                <span key={index} style={style}>
                                    {part.value}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 28px',
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '14px',
                    background: '#fafafa'
                }}>
                    <Button label={t('modal.cancel')} variant="ghost" onClick={onClose} />
                    <Button
                        label={t('app.save')}
                        color="accent"
                        onClick={onConfirm}
                        style={{ backgroundColor: '#00a0e3', color: '#fff', fontWeight: '600' }}
                    />
                </div>
            </Paper>

            <style>{`
                @keyframes modalSlideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
