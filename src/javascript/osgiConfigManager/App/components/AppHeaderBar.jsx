import React from 'react';
import {
    Separator,
    Typography,
    AddCircle,
    CloudDownload,
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
    onExport,
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

            {/* No role="toolbar": independent buttons, each a Tab stop, without the arrow-key model
                that role promises (WCAG 4.1.2). */}
            <div className="flexRow_between alignCenter moonstone-header_toolbar">
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

                    {/* An icon the Moonstone of Jahia 8.2.3 already serves (the file Download's): the
                        library comes from Jahia, not from this module. */}
                    <ActionButton
                        dataCy="export-archive-button"
                        tooltip={t('tooltip.exportArchive')}
                        icon={<CloudDownload/>}
                        label={t('app.export')}
                        onClick={onExport}
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
                accept=".yml,.cfg,.ocmx"
                onChange={onUploadFileChange}
            />
        </header>
    );
};
