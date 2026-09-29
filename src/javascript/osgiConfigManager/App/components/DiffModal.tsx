import React, { useEffect, useMemo, useState } from 'react';
import { Button, Typography, Paper, Close, Visibility, Hidden } from '@jahia/moonstone';
import { diffLines, Change } from 'diff';
import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../hooks/useDialogA11y';
// @ts-ignore - plain JS module
import { languageOfFile, maskSecrets, secretKeyTester } from '../utils/secretMask';

interface DiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    originalContent: string;
    newContent: string;
    filename: string;
    /** The Metatype of the file, so a Password attribute is masked like in the editors. */
    metatypeDefinition?: { properties?: Array<{ id?: string; type?: string }> } | null;
}

/**
 * The parts of the diff, each with the text to show: the secret values masked (see secretMask).
 * The masked texts keep the length of every line, so the offsets of a part in the original and
 * the new content are also its offsets in their masked versions.
 */
export const maskedDiffParts = (changes: Change[], maskedOriginal: string, maskedNew: string) => {
    let originalOffset = 0;
    let newOffset = 0;
    return changes.map(part => {
        const length = part.value.length;
        let text: string;
        if (part.added) {
            text = maskedNew.slice(newOffset, newOffset + length);
            newOffset += length;
        } else if (part.removed) {
            text = maskedOriginal.slice(originalOffset, originalOffset + length);
            originalOffset += length;
        } else {
            text = maskedNew.slice(newOffset, newOffset + length);
            newOffset += length;
            originalOffset += length;
        }
        return { part, text };
    });
};

export const DiffModal: React.FC<DiffModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    originalContent,
    newContent,
    filename,
    metatypeDefinition
}) => {
    const { t } = useTranslation('osgi-configurations-manager');
    // Masked on every opening: the review shows the whole file, secrets included.
    const [secretsVisible, setSecretsVisible] = useState(false);
    useEffect(() => {
        if (isOpen) {
            setSecretsVisible(false);
        }
    }, [isOpen]);

    // Focus into the dialog, trap Tab, close on Escape, restore focus on unmount.
    const dialogRef = useDialogA11y(isOpen, onClose);

    const changes = useMemo(() => {
        if (!originalContent && !newContent) return [];
        return diffLines(originalContent || '', newContent || '');
    }, [originalContent, newContent]);

    const { parts, hasSecrets } = useMemo(() => {
        const language = languageOfFile(filename);
        const isSecretKey = secretKeyTester(metatypeDefinition);
        const maskedOriginal = maskSecrets(originalContent || '', language, isSecretKey);
        const maskedNew = maskSecrets(newContent || '', language, isSecretKey);
        return {
            parts: maskedDiffParts(changes, maskedOriginal, maskedNew),
            hasSecrets: maskedOriginal !== (originalContent || '') || maskedNew !== (newContent || '')
        };
    }, [changes, originalContent, newContent, filename, metatypeDefinition]);

    if (!isOpen) return null;

    return (
        <div
            data-cy="diff-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('modal.diff.title', { name: filename })}
            style={{
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
                ref={dialogRef}
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
                    {hasSecrets && (
                        <div data-cy="diff-modal-toggle-secrets" data-state={secretsVisible ? 'visible' : 'masked'} style={{ marginLeft: 'auto', marginRight: '16px' }}>
                            <Button
                                variant="ghost"
                                label={secretsVisible ? t('editor.button.hideSecrets') : t('editor.button.showSecretsInDiff')}
                                icon={secretsVisible ? <Hidden /> : <Visibility />}
                                onClick={() => setSecretsVisible(visible => !visible)}
                                title={secretsVisible ? t('tooltip.hideSecrets') : t('tooltip.showSecrets')}
                            />
                        </div>
                    )}
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
                        {parts.map(({ part, text }, index: number) => {
                            const style: React.CSSProperties = {
                                backgroundColor: part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent',
                                color: part.added ? '#1e7e34' : part.removed ? '#cb2431' : '#333',
                                display: 'block',
                                textDecoration: 'none'
                            };

                            // diffLines returns parts that end with newline usually
                            return (
                                <span key={index} style={style}>
                                    {secretsVisible ? part.value : text}
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
                    <div data-cy="diff-modal-cancel">
                        <Button label={t('modal.cancel')} variant="ghost" onClick={onClose} />
                    </div>
                    <div data-cy="diff-modal-confirm">
                        <Button
                            label={t('app.save')}
                            color="accent"
                            onClick={onConfirm}
                            style={{ backgroundColor: '#00a0e3', color: '#fff', fontWeight: '600' }}
                        />
                    </div>
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
