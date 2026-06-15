import React from 'react';
import {
    Separator,
    Typography,
    AddCircle,
    CloudUpload,
    Replay
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {ActionButton} from './ActionButton';

export const AppHeaderBar = ({
    title,
    onCreate,
    onUploadClick,
    onUploadFileChange,
    onRefresh,
    uploadInputRef
}) => {
    const {t} = useTranslation('osgi-configurations-manager');

    return (
        <header className="moonstone-header" data-cy="app-header">
            <div className="moonstone-header_main flexRow alignCenter flexFluid">
                <Typography
                    isNowrap
                    component="h1"
                    variant="title"
                    className="flexFluid moonstone-header_title"
                >
                    {title}
                </Typography>
            </div>

            <Separator spacing="none" size="full"/>

            <div role="group" aria-label={title} className="flexRow_between alignCenter moonstone-header_toolbar">
                <div className="flexRow alignCenter flexFluid moonstone-header_actions">
                    <ActionButton
                        dataCy="create-file-button"
                        tooltip={t('tooltip.createFile')}
                        icon={<AddCircle/>}
                        label={t('app.new')}
                        onClick={onCreate}
                    />

                    <ActionButton
                        dataCy="upload-file-button"
                        tooltip={t('tooltip.uploadFile')}
                        icon={<CloudUpload/>}
                        label={t('app.import')}
                        onClick={onUploadClick}
                    />

                    <ActionButton
                        dataCy="refresh-files-button"
                        tooltip={t('tooltip.refreshFiles')}
                        icon={<Replay/>}
                        label={t('app.refresh')}
                        onClick={onRefresh}
                    />
                </div>
            </div>

            <input
                data-cy="upload-file-input"
                type="file"
                ref={uploadInputRef}
                style={{display: 'none'}}
                accept=".yml,.cfg"
                onChange={onUploadFileChange}
            />
        </header>
    );
};
