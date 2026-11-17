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
    PANEL_HEADER_STYLE,
    VISUALLY_HIDDEN_STYLE
} from './AppChrome';

const BLOCKED_REASON_DELAY_MS = 1500;
const LISTED_ERRORS = 5;
// hasUnsaved follows the content, so typing that brings a value back flips it: the change is
// announced once it has lasted, once per file, and announced again only after the file has been
// clean for a while (a save, a cancel).
const UNSAVED_ANNOUNCE_DELAY_MS = 1000;
const UNSAVED_RESET_DELAY_MS = 2000;
const UNSAVED_MESSAGE_LIFETIME_MS = 5000;

// warning_dark on warning_plain20 is 6.69:1 (WCAG 1.4.3); its border, 3:1 or more, keeps the chip's
// shape in forced colours.
const UNSAVED_CHIP_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid var(--color-warning_dark)',
    background: 'var(--color-warning_plain20)',
    color: 'var(--color-warning_dark)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    lineHeight: '1.4',
    whiteSpace: 'nowrap',
    flexShrink: 0
};

const WRAP_STYLE = {overflowWrap: 'anywhere', wordBreak: 'break-word'};

const useUnsavedAnnouncement = (hasUnsaved, fileName, message) => {
    const [announcement, setAnnouncement] = useState('');
    const announcedRef = React.useRef(false);
    const messageRef = React.useRef(message);
    messageRef.current = message;

    useEffect(() => {
        announcedRef.current = false;
        setAnnouncement('');
    }, [fileName]);

    useEffect(() => {
        if (!hasUnsaved) {
            const reset = window.setTimeout(() => {
                announcedRef.current = false;
            }, UNSAVED_RESET_DELAY_MS);
            return () => window.clearTimeout(reset);
        }
        if (announcedRef.current) {
            return undefined;
        }
        let clear;
        const timer = window.setTimeout(() => {
            announcedRef.current = true;
            setAnnouncement(messageRef.current);
            clear = window.setTimeout(() => setAnnouncement(''), UNSAVED_MESSAGE_LIFETIME_MS);
        }, UNSAVED_ANNOUNCE_DELAY_MS);
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(clear);
        };
    }, [hasUnsaved]);

    return announcement;
};

const BLOCKED_REASON_STYLE = {
    maxWidth: '420px',
    color: 'var(--color-danger_dark)',
    textAlign: 'right'
};

export const SelectedFileHeader = ({
    selectedFile,
    titleId,
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
    const unsavedAnnouncement = useUnsavedAnnouncement(hasUnsaved, selectedFile.name, t('app.unsavedAnnouncement', {name: selectedFile.name, interpolation: {escapeValue: false}}));

    return (
        <div style={{...PANEL_HEADER_STYLE, alignItems: 'flex-start', columnGap: '16px', rowGap: '6px', flexWrap: 'wrap'}}>
            {/* A 240px basis, not auto: a long name would otherwise always push Save to a second line. */}
            <div style={{minWidth: 0, flex: '1 1 240px'}}>
                {/* The open file's heading, which also names the editor region (WCAG 1.3.1). It wraps
                    rather than being cut: nothing showed the rest of a long name. */}
                <div style={{display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', minWidth: 0}}>
                    <div data-cy="selected-file-name" style={{minWidth: 0}}>
                        <Typography id={titleId} component="h2" variant="heading" style={{margin: 0, ...WRAP_STYLE}}>
                            {selectedFile.name}
                        </Typography>
                    </div>
                    {/* Outside the heading, which stays the file name. Announced through the region
                        below, once, not at every keystroke. */}
                    {hasUnsaved && (
                        <span data-cy="unsaved-indicator" style={UNSAVED_CHIP_STYLE}>{t('app.unsaved')}</span>
                    )}
                    <div data-cy="unsaved-status" role="status" style={VISUALLY_HIDDEN_STYLE}>{unsavedAnnouncement}</div>
                </div>
            </div>

            {/* The path wraps rather than being cut, on a row of its own across the whole header (after
                Save in the visual order only), so that it rarely needs a second line. */}
            <div style={{order: 2, flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0}}>
                <div data-cy="selected-file-path" style={{flex: '0 1 auto', minWidth: 0}}>
                    <Typography variant="caption" style={{color: CHROME_TOKENS.subtleTextColor, display: 'block', ...WRAP_STYLE}}>
                        {selectedFile.path}
                    </Typography>
                </div>
                <ConfigStateBadge
                    state={selectedConfigState}
                    showTooltip={!['MODULE', 'MODULE_DEFAULT'].includes(selectedConfigState)}
                />
            </div>

            <div style={{order: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0}}>
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
                    {/* Named after its effect: "Cancel" is also the word that closes the dialogs. */}
                    <ActionButton
                        dataCy="cancel-config-button"
                        tooltip={t('tooltip.discardChanges')}
                        describeTooltip
                        label={t('app.discardChanges')}
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
