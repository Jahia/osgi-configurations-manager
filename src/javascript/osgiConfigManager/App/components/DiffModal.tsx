import React, { useEffect, useMemo, useState } from 'react';
import { Button, Typography, Paper, Close, Visibility, Hidden } from '@jahia/moonstone';
import { diffLines, Change } from 'diff';
import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../hooks/useDialogA11y';
// @ts-ignore - plain JS module
import { languageOfFile, maskSecrets, secretKeyTester } from '../utils/secretMask';
// @ts-ignore - plain JS module
import { VISUALLY_HIDDEN_STYLE as HIDDEN_STYLE } from './AppChrome';

const VISUALLY_HIDDEN_STYLE = HIDDEN_STYLE as React.CSSProperties;

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
    const titleId = React.useId();
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
            // On the dialog element itself: the Paper of the Moonstone version Jahia serves does not
            // forward its ref, so the hook found no container, and Tab was blocked behind the dialog.
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
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
            // At 400% zoom the dialog is taller than the window: the overlay scrolls (WCAG 1.4.10).
            overflowY: 'auto',
            padding: '16px',
            boxSizing: 'border-box',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s ease'
        }} onClick={onClose}>
            <Paper
                style={{
                    width: '900px',
                    maxWidth: '100%',
                    margin: 'auto',
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
                    <Typography id={titleId} component="h2" variant="heading" weight="bold" style={{ fontSize: '18px', color: '#111', margin: 0 }}>
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
                    {/* A button: the clickable icon could not be reached by Tab nor named (WCAG 4.1.2). */}
                    <Button
                        data-cy="diff-modal-close"
                        variant="ghost"
                        icon={<Close />}
                        aria-label={t('modal.close')}
                        title={t('modal.close')}
                        onClick={onClose}
                    />
                </div>

                {/* Body */}
                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Focusable and named, so the keyboard can scroll a long diff (WCAG 2.1.1). */}
                    <div
                        data-cy="diff-modal-changes"
                        className="osgi-scroll-region"
                        role="region"
                        aria-label={t('modal.diff.changes')}
                        tabIndex={0}
                        style={{
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
                            const lines = (secretsVisible ? part.value : text).replace(/\n$/, '').split('\n');
                            // Added and removed lines differed only by colour (WCAG 1.4.1, 1.3.1): each
                            // line now starts with a visible + or − and, for screen readers, a word.
                            const marker = part.added ? '+' : part.removed ? '−' : ' ';
                            const spoken = part.added ? t('modal.diff.added') : part.removed ? t('modal.diff.removed') : null;
                            const Tag = part.added ? 'ins' : part.removed ? 'del' : 'span';
                            return (
                                <Tag key={index} data-diff={part.added ? 'added' : part.removed ? 'removed' : 'same'} style={style}>
                                    {lines.map((line, lineIndex) => (
                                        <span key={lineIndex} style={{ display: 'block' }}>
                                            <span aria-hidden="true" style={{ display: 'inline-block', width: '2ch', userSelect: 'none' }}>{marker}</span>
                                            {spoken && <span style={VISUALLY_HIDDEN_STYLE}>{spoken} </span>}
                                            {line}
                                        </span>
                                    ))}
                                </Tag>
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
                            // accent_dark: white on Moonstone's accent (#00a0e3) is 2.9:1 (WCAG 1.4.3).
                            style={{ backgroundColor: 'var(--color-accent_dark)', color: '#fff', fontWeight: '600' }}
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
