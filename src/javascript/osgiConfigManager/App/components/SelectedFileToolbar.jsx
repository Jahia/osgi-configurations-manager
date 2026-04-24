import React from 'react';
import {
    CloudDownload,
    Delete,
    Dropdown,
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
    minWidth: '160px'
};

export const SelectedFileToolbar = ({
    selectedFile,
    canMarkAsDefault,
    isRawMode,
    onToggleFile,
    onMarkAsDefault,
    onDownloadFile,
    onDeleteFile,
    onSetEditorMode
}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const isCfgFile = selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled');
    const isEnabled = selectedFile.enabled !== false && !selectedFile.name.endsWith('.disabled');
    const modeOptions = [
        {
            label: t('editor.button.modeVisual'),
            value: 'visual',
            iconStart: <ViewList style={BUTTON_ICON_STYLE} />
        },
        {
            label: t('editor.button.modeRaw'),
            value: 'raw',
            iconStart: <Code style={BUTTON_ICON_STYLE} />
        }
    ];

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
                <div data-cy="editor-mode-toggle" data-mode={isRawMode ? 'raw' : 'visual'} style={MODE_SELECTOR_STYLE}>
                    <Dropdown
                        data-cy="editor-mode-dropdown"
                        variant="ghost"
                        size="small"
                        value={isRawMode ? 'raw' : 'visual'}
                        icon={isRawMode ? <Code style={BUTTON_ICON_STYLE} /> : <ViewList style={BUTTON_ICON_STYLE} />}
                        data={modeOptions}
                        onChange={(event, item) => {
                            if (item?.value) {
                                onSetEditorMode(item.value);
                            }
                            return true;
                        }}
                    />
                </div>
            )}
        </div>
    );
};
