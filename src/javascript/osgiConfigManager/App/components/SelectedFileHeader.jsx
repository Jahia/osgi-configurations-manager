import React, {useEffect, useId, useState} from 'react';
import {
    Save,
    Typography
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {ConfigStateBadge} from './ConfigStateBadge';
import {ActionButton} from './ActionButton';
import {configFileKind} from '../utils/configIdentity';
import {
    CHROME_TOKENS,
    OverflowPreviewText,
    PANEL_HEADER_STYLE
} from './AppChrome';

const BLOCKED_REASON_DELAY_MS = 1500;
const LISTED_ERRORS = 5;

const BLOCKED_REASON_STYLE = {
    maxWidth: '420px',
    color: 'var(--color-danger_dark)',
    textAlign: 'right'
};

export const SelectedFileHeader = ({
    selectedFile,
    selectedConfigState,
    hasUnsaved,
    isRawMode,
    isYamlValid,
    validationErrors = [],
    isSaving = false,
    onSave,
    onCancel
}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const isYamlFile = configFileKind(selectedFile.name) === 'yml';
    const isBlockedByErrors = hasUnsaved && (isRawMode || isYamlFile) && !isYamlValid;
    const blockedReasonId = useId();
    // Unavailable, Save and Cancel keep the focus (aria-disabled, never the disabled attribute):
    // after a confirmed save or a cancel the focused button became disabled, which dropped the focus
    // to the page. Moonstone's Button also sets disabled from isLoading/isDisabled: neither is passed.
    const saveUnavailable = !hasUnsaved || isSaving || isBlockedByErrors;
    const cancelUnavailable = !hasUnsaved || isSaving;

    // Typing passes through invalid states (a .cfg line has no key until its '='), so the reason is
    // shown, and announced, only once the content has stayed invalid for a moment.
    const [showBlockedReason, setShowBlockedReason] = useState(false);
    useEffect(() => {
        if (!isBlockedByErrors) {
            setShowBlockedReason(false);
            return undefined;
        }
        const timer = window.setTimeout(() => setShowBlockedReason(true), BLOCKED_REASON_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isBlockedByErrors]);

    const listedErrors = validationErrors.slice(0, LISTED_ERRORS);

    return (
        <div style={{...PANEL_HEADER_STYLE, alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap'}}>
            {/* A 240px basis, not auto: the path's full length would otherwise always push Save to a second line. */}
            <div style={{minWidth: 0, flex: '1 1 240px'}}>
                <div data-cy="selected-file-name">
                    <OverflowPreviewText
                        text={selectedFile.name}
                        showPreview={false}
                        typographyProps={{variant: 'heading'}}
                        textStyle={{display: 'block'}}
                    />
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', minWidth: 0, flexWrap: 'wrap'}}>
                    <div data-cy="selected-file-path" style={{minWidth: 0, flex: '1 1 320px'}}>
                        <OverflowPreviewText
                            text={selectedFile.path}
                            typographyProps={{variant: 'caption', color: 'textSecondary'}}
                            textStyle={{color: CHROME_TOKENS.subtleTextColor, display: 'block'}}
                        />
                    </div>
                    <ConfigStateBadge
                        state={selectedConfigState}
                        showTooltip={!['MODULE', 'MODULE_DEFAULT'].includes(selectedConfigState)}
                    />
                </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0}}>
                <div
                    data-cy="header-actions-row"
                    style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end'
                    }}
                >
                    <ActionButton
                        dataCy="cancel-config-button"
                        tooltip={t('modal.cancel')}
                        label={t('modal.cancel')}
                        size="big"
                        aria-disabled={cancelUnavailable || undefined}
                        // Decided at the click, not only at render: a held key repeats before React renders.
                        onClick={() => {
                            if (!cancelUnavailable) {
                                onCancel();
                            }
                        }}
                    />

                    {/* Blocked by errors, its description is the reason below. */}
                    <ActionButton
                        dataCy="save-config-button"
                        tooltip={t('tooltip.save')}
                        label={t('app.save')}
                        color="accent"
                        icon={<Save size="big" />}
                        size="big"
                        variant="default"
                        aria-disabled={saveUnavailable || undefined}
                        aria-describedby={isBlockedByErrors ? blockedReasonId : undefined}
                        // Never undefined: Moonstone's Button calls its onClick unconditionally.
                        onClick={() => {
                            if (!saveUnavailable) {
                                onSave();
                            }
                        }}
                    />
                </div>

                {/* Visual: the editor pane's status region announces it. */}
                {isSaving && (
                    <Typography data-cy="save-in-progress" variant="caption" aria-hidden="true" style={{color: CHROME_TOKENS.subtleTextColor}}>
                        {t('app.saving')}
                    </Typography>
                )}

                <div data-cy="save-blocked-reason" style={BLOCKED_REASON_STYLE}>
                    {/* Always mounted, so that the reason is announced when it appears; a div, as
                        Moonstone's Typography renders nothing while empty. Only the sentence is live:
                        the list changes at every keystroke. */}
                    <div id={blockedReasonId} role="status">
                        {showBlockedReason && (
                            <Typography variant="caption" style={{color: 'inherit'}}>
                                {t('editor.validation.saveBlocked', {count: validationErrors.length})}
                            </Typography>
                        )}
                    </div>
                    {showBlockedReason && listedErrors.length > 0 && (
                        <ul data-cy="save-blocked-errors" style={{margin: '4px 0 0', padding: 0, listStyle: 'none'}}>
                            {listedErrors.map(error => (
                                <li key={`${error.line}:${error.message}`}>
                                    <Typography variant="caption" style={{color: 'inherit'}}>
                                        {t('editor.validation.errorAt', {line: error.line, message: error.message})}
                                    </Typography>
                                </li>
                            ))}
                            {validationErrors.length > LISTED_ERRORS && (
                                <li>
                                    <Typography variant="caption" style={{color: 'inherit'}}>
                                        {t('editor.validation.moreErrors', {count: validationErrors.length - LISTED_ERRORS})}
                                    </Typography>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
