import React from 'react';
import {
    Button,
    CloudDownload,
    Delete,
    Module,
    Code,
    ViewList,
    Not,
    Check
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {CHROME_TOKENS, PANEL_ACTIONS_STYLE} from './AppChrome';
import {ActionButton} from './ActionButton';

const BUTTON_ICON_STYLE = {width: '16px', height: '16px'};

const TOOLBAR_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '8px 0 12px',
    //marginBottom: '12px',
    borderBottom: `1px solid ${CHROME_TOKENS.panelBorderColor}`
};

const TOOLBAR_GROUP_STYLE = {
    ...PANEL_ACTIONS_STYLE,
    gap: '8px',
    flexWrap: 'wrap'
};

const MODE_SELECTOR_STYLE = {
    display: 'flex',
    gap: '4px'
};

export const SelectedFileToolbar = ({
    selectedFile,
    canMarkAsDefault,
    isRawMode,
    onToggleFile,
    onMarkAsDefault,
    onDownloadFile,
    onDeleteFile,
    onSetEditorMode,
    isLoadingFile = false
}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const isCfgFile = selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled');
    const isEnabled = selectedFile.enabled !== false && !selectedFile.name.endsWith('.disabled');
    const modeOptions = [
        {label: t('editor.button.modeVisual'), value: 'visual', icon: <ViewList style={BUTTON_ICON_STYLE} />},
        {label: t('editor.button.modeRaw'), value: 'raw', icon: <Code style={BUTTON_ICON_STYLE} />}
    ];
    const currentMode = isRawMode ? 'raw' : 'visual';

    return (
        <div data-cy="selected-file-toolbar" style={TOOLBAR_STYLE}>
            <div style={TOOLBAR_GROUP_STYLE}>
                <ActionButton
                    dataCy="toggle-file-switch"
                    tooltip={t('tooltip.toggleFile')}
                    label={isEnabled ? t('modal.disableFile.confirm') : t('app.enable')}
                    icon={isEnabled ? <Not style={BUTTON_ICON_STYLE} /> : <Check style={BUTTON_ICON_STYLE} />}
                    onClick={() => onToggleFile(selectedFile)}
                />
                <ActionButton
                    dataCy="mark-as-default-button"
                    tooltip={t('tooltip.markAsDefault')}
                    label={t('app.markAsDefault')}
                    icon={<Module style={BUTTON_ICON_STYLE} />}
                    onClick={() => onMarkAsDefault(selectedFile)}
                    disabled={!canMarkAsDefault}
                />
                <ActionButton
                    dataCy="download-file-button"
                    tooltip={t('tooltip.downloadFile')}
                    label={t('app.download')}
                    icon={<CloudDownload style={BUTTON_ICON_STYLE} />}
                    onClick={() => onDownloadFile(selectedFile)}
                />
                <ActionButton
                    dataCy="delete-file-button"
                    tooltip={t('tooltip.deleteFile')}
                    label={t('app.delete')}
                    color="danger"
                    icon={<Delete style={BUTTON_ICON_STYLE} />}
                    variant="default"
                    onClick={() => onDeleteFile(selectedFile)}
                />
            </div>

            {isCfgFile && (
                // Two pressed/unpressed buttons rather than Moonstone's Dropdown: its menu opened on
                // Enter but kept the focus on the trigger, so the mode could not be changed from the
                // keyboard (WCAG 2.1.1), and the trigger was announced as a listbox (4.1.2).
                <div
                    data-cy="editor-mode-toggle"
                    data-mode={currentMode}
                    data-loading={isLoadingFile ? 'true' : 'false'}
                    role="group"
                    aria-label={t('editor.modeLabel')}
                    style={MODE_SELECTOR_STYLE}
                >
                    {modeOptions.map(option => (
                        <Button
                            key={option.value}
                            data-cy={`editor-mode-${option.value}`}
                            label={option.label}
                            icon={option.icon}
                            size="small"
                            // The current mode is filled, the other one ghost; aria-pressed says which.
                            variant={currentMode === option.value ? 'default' : 'ghost'}
                            aria-pressed={currentMode === option.value}
                            isDisabled={isLoadingFile}
                            onClick={() => {
                                if (currentMode !== option.value) {
                                    onSetEditorMode(option.value);
                                }
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
