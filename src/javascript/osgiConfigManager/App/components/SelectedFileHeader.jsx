import React from 'react';
import {
    Save
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {ConfigStateBadge} from './ConfigStateBadge';
import {ActionButton} from './ActionButton';
import {
    CHROME_TOKENS,
    OverflowPreviewText,
    PANEL_HEADER_STYLE
} from './AppChrome';

export const SelectedFileHeader = ({
    selectedFile,
    selectedConfigState,
    hasUnsaved,
    isRawMode,
    isYamlValid,
    onSave,
    onCancel
}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const isYamlFile = selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled');
    const isSaveDisabled = !hasUnsaved || ((isRawMode || isYamlFile) && !isYamlValid);

    return (
        <div style={{...PANEL_HEADER_STYLE, alignItems: 'flex-start', gap: '16px'}}>
            <div style={{minWidth: 0, flex: '1 1 auto'}}>
                <div data-cy="selected-file-name">
                    <OverflowPreviewText
                        text={selectedFile.name}
                        showPreview={false}
                        typographyProps={{variant: 'heading', component: 'h2'}}
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
                        onClick={onCancel}
                        disabled={!hasUnsaved}
                    />

                    <ActionButton
                        dataCy="save-config-button"
                        tooltip={t('tooltip.save')}
                        label={t('app.save')}
                        color="accent"
                        icon={<Save size="big" />}
                        size="big"
                        variant="default"
                        onClick={onSave}
                        disabled={isSaveDisabled}
                    />
                </div>
            </div>
        </div>
    );
};
