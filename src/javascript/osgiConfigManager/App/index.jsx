import React from 'react';
import {
    LayoutContent,
    Paper,
    Typography
} from '@jahia/moonstone';
import { useOsgiConfigs } from './hooks/useOsgiConfigs';
import {
    APP_LAYOUT_STYLE,
    EMPTY_STATE_STYLE,
    InlineLoader,
    PANEL_STYLE,
    StatusBanner
} from './components/AppChrome';
import { FileSidebar } from './components/FileSidebar';
import { ConfigEditor } from './components/Editor';
import { CfgEditor } from './components/CfgEditor';
import { MonacoEditor } from './components/MonacoEditor';
import { ModalDialog } from './components/Dialogs';
import { DiffModal } from './components/DiffModal';
import { SelectedFileHeader } from './components/SelectedFileHeader';
import { SelectedFileToolbar } from './components/SelectedFileToolbar';
import { AppHeaderBar } from './components/AppHeaderBar';
import { useTranslation } from 'react-i18next';
import { ToastProvider } from './hooks/useToast';

const AppContent = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const {
        files,
        selectedFile,
        selectFile,
        properties,
        rawContent,
        metatypeInfo,
        hasUnsaved,
        loadingFiles,
        loadingFile,
        error,
        isCreatingFile,
        setIsCreatingFile,
        newFileName,
        setNewFileName,
        collapsedPaths,
        handleSave,
        handleToggleFile,
        handleDeleteFile,
        handleMarkAsDefault,
        handleOpenCreateDialog,
        handlePropUpdate,
        handleRawUpdate,
        handleAddProperty,
        handleAddItem,
        handleDeleteProperty,
        toggleCollapse,
        searchTerm,
        setSearchTerm,
        modalConfig,
        setModalConfig,
        diffConfig,
        setDiffConfig,
        isYamlValid,
        setIsYamlValid,
        handleAddCfgEntry,
        handleReorder,
        handleUploadFile,
        searchInContent,
        setSearchInContent,
        isRawMode,
        handleSetEditorMode,
        handleCancelChanges,
        handleRefreshFiles,
        visualFormattingControlsEnabled,
        showComments,
        handleToggleComments,
        setShowComments,
        showEmptyLines,
        handleToggleEmptyLines,
        setShowEmptyLines,
        handleToggleEncryption
    } = useOsgiConfigs();

    const selectedConfigState = selectedFile?.configState || 'USER';
    const uploadInputRef = React.useRef(null);
    const isConfigFile = selectedFile && (
        selectedFile.name.endsWith('.cfg') ||
        selectedFile.name.endsWith('.cfg.disabled') ||
        selectedFile.name.endsWith('.yml') ||
        selectedFile.name.endsWith('.yml.disabled')
    );
    const canMarkAsDefault = Boolean(isConfigFile && selectedConfigState === 'USER');

    const handleDownloadSelectedFile = React.useCallback(file => {
        if (!file?.name) {
            return;
        }

        const element = document.createElement('a');
        const downloadContent = rawContent ?? '';
        const blob = new Blob([downloadContent], {type: 'text/plain'});
        const downloadUrl = URL.createObjectURL(blob);
        element.href = downloadUrl;
        element.download = file.name;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(downloadUrl);
    }, [rawContent]);

    const runWithUnsavedConfirmation = React.useCallback(action => {
        if (!hasUnsaved) {
            action();
            return;
        }

        setModalConfig({
            type: 'confirm',
            severity: 'warning',
            title: t('modal.unsaved.title'),
            message: t('modal.unsaved.message'),
            confirmLabel: t('modal.unsaved.confirm'),
            cancelLabel: t('modal.unsaved.cancel'),
            onConfirm: action
        });
    }, [hasUnsaved, setModalConfig, t]);

    const handleFileClick = React.useCallback(f => {
        if (selectedFile?.name === f.name) {
            return;
        }

        runWithUnsavedConfirmation(() => selectFile(f));
    }, [runWithUnsavedConfirmation, selectFile, selectedFile]);

    const handleCancelClick = React.useCallback(() => {
        runWithUnsavedConfirmation(() => {
            void handleCancelChanges();
        });
    }, [handleCancelChanges, runWithUnsavedConfirmation]);

    const handleMarkAsDefaultClick = React.useCallback(() => {
        if (!selectedFile) {
            return;
        }

        runWithUnsavedConfirmation(() => {
            void handleMarkAsDefault(selectedFile);
        });
    }, [handleMarkAsDefault, runWithUnsavedConfirmation, selectedFile]);

    const handleToggleFileClick = React.useCallback(() => {
        if (!selectedFile) {
            return;
        }

        runWithUnsavedConfirmation(() => {
            void handleToggleFile(selectedFile);
        });
    }, [handleToggleFile, runWithUnsavedConfirmation, selectedFile]);

    const handleOpenCreateDialogClick = React.useCallback(() => {
        runWithUnsavedConfirmation(() => {
            void handleOpenCreateDialog();
        });
    }, [handleOpenCreateDialog, runWithUnsavedConfirmation]);

    const openUploadPicker = React.useCallback(() => {
        uploadInputRef.current?.click();
    }, []);

    const handleUploadClick = React.useCallback(() => {
        if (!hasUnsaved) {
            openUploadPicker();
            return;
        }

        setModalConfig({
            type: 'confirm',
            severity: 'warning',
            title: t('modal.unsaved.title'),
            message: t('modal.unsaved.message'),
            confirmLabel: t('modal.unsaved.confirm'),
            cancelLabel: t('modal.unsaved.cancel'),
            deferConfirm: false,
            onConfirm: openUploadPicker
        });
    }, [hasUnsaved, openUploadPicker, setModalConfig, t]);

    const handleUploadFileChange = React.useCallback(event => {
        const file = event.target.files?.[0];
        if (file) {
            void handleUploadFile(file);
        }

        event.target.value = null;
    }, [handleUploadFile]);

    const handleRefreshClick = React.useCallback(() => {
        runWithUnsavedConfirmation(() => {
            void handleRefreshFiles();
        });
    }, [handleRefreshFiles, runWithUnsavedConfirmation]);

    return (
        <>
            <LayoutContent
                header={
                    <AppHeaderBar
                        title={t('app.title')}
                        onCreate={handleOpenCreateDialogClick}
                        onUploadClick={handleUploadClick}
                        onUploadFileChange={handleUploadFileChange}
                        onRefresh={handleRefreshClick}
                        uploadInputRef={uploadInputRef}
                    />
                }
                content={
                    <div data-cy="osgi-config-manager" style={APP_LAYOUT_STYLE}>
                        {/* LEFT PANE: File List */}
                        <FileSidebar
                            files={files}
                            selectedFile={selectedFile}
                            handleFileClick={handleFileClick}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            searchInContent={searchInContent}
                            setSearchInContent={setSearchInContent}
                        />

                        {/* RIGHT PANE: Editor */}
                        <Paper role="main" style={{ ...PANEL_STYLE, flex: '1 1 0%', overflow: 'hidden', minWidth: 0, marginTop: 0 }}>
                            {!selectedFile ? (
                                <div style={EMPTY_STATE_STYLE}>
                                    <Typography variant="heading">{t('app.selectConfig')}</Typography>
                                    {loadingFiles && <InlineLoader label={t('app.loadingFiles')} />}
                                </div>
                            ) : (
                                <>
                                    <SelectedFileHeader
                                        selectedFile={selectedFile}
                                        selectedConfigState={selectedConfigState}
                                        hasUnsaved={hasUnsaved}
                                        isRawMode={isRawMode}
                                        isYamlValid={isYamlValid}
                                        onSave={() => handleSave()}
                                        onCancel={handleCancelClick}
                                    />

                                    {error && <StatusBanner tone="error" message={error} />}

                                    {!error && selectedConfigState === 'MODULE' && (
                                        <StatusBanner
                                            tone="warning"
                                            dataCy="config-state-module-warning"
                                            message={t('configState.banner.module')}
                                        />
                                    )}

                                    {!error && selectedConfigState === 'MODULE_DEFAULT' && (
                                        <StatusBanner
                                            tone="info"
                                            dataCy="config-state-module-default-info"
                                            message={t('configState.banner.moduleDefault')}
                                        />
                                    )}

                                    {!error && (
                                        <SelectedFileToolbar
                                            selectedFile={selectedFile}
                                            canMarkAsDefault={canMarkAsDefault}
                                            isRawMode={isRawMode}
                                            onToggleFile={handleToggleFileClick}
                                            onMarkAsDefault={handleMarkAsDefaultClick}
                                            onDownloadFile={handleDownloadSelectedFile}
                                            onDeleteFile={handleDeleteFile}
                                            onSetEditorMode={handleSetEditorMode}
                                        />
                                    )}

                                    <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: '8px', minWidth: 0 }}>
                                        {loadingFile ? (
                                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                                <InlineLoader label={t('app.loadingFile')} />
                                            </div>
                                        ) : (
                                            <>
                                                {(selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) ? (
                                                    <MonacoEditor
                                                        value={rawContent}
                                                        onChange={handleRawUpdate}
                                                        onValidate={setIsYamlValid}
                                                        metatypeDefinition={metatypeInfo}
                                                        filename={selectedFile.name}
                                                    />
                                                ) : (selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled')) ? (
                                                    isRawMode ? (
                                                        <MonacoEditor
                                                            value={rawContent}
                                                            onChange={handleRawUpdate}
                                                            onValidate={setIsYamlValid}
                                                            language="properties"
                                                            metatypeDefinition={metatypeInfo}
                                                            filename={selectedFile.name}
                                                        />
                                                    ) : (
                                                        <CfgEditor
                                                            entries={properties} // In .cfg mode, properties is an array
                                                            handlePropUpdate={handlePropUpdate}
                                                            handleDeleteProperty={handleDeleteProperty}
                                                            handleAddCfgEntry={handleAddCfgEntry}
                                                            handleReorder={handleReorder}
                                                            setModalConfig={setModalConfig}
                                                            handleToggleEncryption={handleToggleEncryption}
                                                            visualFormattingControlsEnabled={visualFormattingControlsEnabled}
                                                            showComments={showComments}
                                                            handleToggleComments={handleToggleComments}
                                                            setShowComments={setShowComments}
                                                            showEmptyLines={showEmptyLines}
                                                            handleToggleEmptyLines={handleToggleEmptyLines}
                                                            setShowEmptyLines={setShowEmptyLines}
                                                            metatypeDefinition={metatypeInfo}
                                                        />
                                                    )
                                                ) : (
                                                    <ConfigEditor
                                                        properties={properties}
                                                        collapsedPaths={collapsedPaths}
                                                        toggleCollapse={toggleCollapse}
                                                        handlePropUpdate={handlePropUpdate}
                                                        handleAddProperty={handleAddProperty}
                                                        handleAddItem={handleAddItem}
                                                        handleDeleteProperty={handleDeleteProperty}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </Paper>
                    </div>
                }
            />
            <ModalDialog
                config={modalConfig}
                onClose={() => setModalConfig(null)}
            />
            <DiffModal
                isOpen={diffConfig.isOpen}
                onClose={() => setDiffConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={diffConfig.onConfirm}
                originalContent={diffConfig.originalContent}
                newContent={diffConfig.newContent}
                filename={diffConfig.filename}
            />
        </>
    );
};

const App = () => (
    <ToastProvider>
        <style>
            {`
                @keyframes osgi-config-manager-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) {
                    .osgi-config-manager-spinner { animation: none !important; }
                }
                .osgi-cfg-input:focus-visible {
                    outline: 2px solid var(--color-accent) !important;
                    outline-offset: -1px;
                    border-radius: 2px;
                }
                .osgi-sidebar-status-cell .moonstone-TableCell {
                    padding-left: 0;
                    padding-right: 0;
                }
                .moonstone-tooltip_label {
                    width: max-content;
                    max-width: min(480px, calc(100vw - 32px));
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                }
                .moonstone-tooltip_label .moonstone-typography {
                    display: block;
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                }
            `}
        </style>
        <AppContent />
    </ToastProvider>
);

export default App;
