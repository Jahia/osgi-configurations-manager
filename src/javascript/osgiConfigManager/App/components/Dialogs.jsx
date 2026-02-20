import React from 'react';
import {
    Typography,
    Button,
    Input,
    Paper,
    Close
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';

export const ModalDialog = ({ config, onClose }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [value, setValue] = React.useState(config?.defaultValue || '');

    // Reset value when config changes
    React.useEffect(() => {
        setValue(config?.defaultValue || '');
    }, [config]);

    if (!config) return null;

    const handleConfirm = () => {
        if (config.type === 'prompt') {
            config.onConfirm(value);
        } else {
            if (config.onConfirm) config.onConfirm();
        }
        onClose();
    };

    const isWarning = config.type === 'warning' || (config.type === 'confirm' && config.severity === 'warning');
    const accentColor = isWarning ? '#db3d44' : '#00a0e3'; // Jahia Blue / Warning Red

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
                    width: '520px',
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
                        {config.title}
                    </Typography>
                    <div style={{ cursor: 'pointer', color: '#888', transition: 'color 0.2s' }}
                        onClick={onClose}
                        onMouseOver={e => e.currentTarget.style.color = '#333'}
                        onMouseOut={e => e.currentTarget.style.color = '#888'}>
                        <Close />
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <Typography style={{ fontSize: '16px', color: '#444', lineHeight: '1.6' }}>
                        {config.message}
                    </Typography>

                    {config.type === 'prompt' && (
                        <div style={{ marginTop: '8px' }}>
                            <Input
                                autoFocus
                                value={value}
                                variant="outlined"
                                style={{
                                    width: '100%',
                                    fontSize: '16px',
                                    padding: '8px 12px'
                                    // Removed manual border to avoid double border with Moonstone's outlined variant
                                }}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirm();
                                }}
                                placeholder={t('modal.prompt.placeholder')}
                            />
                        </div>
                    )}
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
                    {config.cancelLabel !== null && (
                        <Button
                            label={config.cancelLabel || t('modal.cancel')}
                            variant="ghost"
                            onClick={onClose}
                        />
                    )}
                    {config.otherLabel && (
                        <Button
                            label={config.otherLabel}
                            variant="outlined"
                            onClick={() => {
                                if (config.onOther) config.onOther();
                                onClose();
                            }}
                        />
                    )}
                    {config.confirmLabel !== null && (
                        <Button
                            label={config.confirmLabel || t('modal.ok')}
                            style={{
                                backgroundColor: accentColor,
                                color: '#fff',
                                minWidth: '100px',
                                fontWeight: '600'
                            }}
                            onClick={handleConfirm}
                        />
                    )}
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
