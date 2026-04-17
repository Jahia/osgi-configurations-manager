import React from 'react';
import {
    LayoutContent,
    Header,
    Paper,
    Typography,
    Button,
    Tooltip,
    Warning,
    Save,
    Code,
    ViewList
} from '@jahia/moonstone';
import { useOsgiConfigs } from './hooks/useOsgiConfigs';
import { FileSidebar } from './components/FileSidebar';
import { ConfigEditor } from './components/Editor';
import { CfgEditor } from './components/CfgEditor';
import { MonacoEditor } from './components/MonacoEditor';
import { ModalDialog } from './components/Dialogs';
import { DiffModal } from './components/DiffModal';
import { ConfigStateBadge } from './components/ConfigStateBadge';
import { useTranslation } from 'react-i18next';
import { ToastProvider } from './hooks/useToast';

const InlineLoader = ({ label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#666' }}>
        <div
            style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid #d8d8d8',
                borderTopColor: '#4f67ff',
                animation: 'osgi-config-manager-spin 0.8s linear infinite',
                flexShrink: 0
            }}
        />
        {label && <Typography variant="body">{label}</Typography>}
    </div>
);

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
        handleCreateFile,
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
        handleToggleRawMode,
        showComments,
        handleToggleComments,
        setShowComments,
        handleToggleEncryption
    } = useOsgiConfigs();

    const selectedConfigState = selectedFile?.configState || 'USER';
    const isConfigFile = selectedFile && (
        selectedFile.name.endsWith('.cfg') ||
        selectedFile.name.endsWith('.cfg.disabled') ||
        selectedFile.name.endsWith('.yml') ||
        selectedFile.name.endsWith('.yml.disabled')
    );
    const canMarkAsDefault = Boolean(isConfigFile && selectedConfigState === 'USER');

    const handleFileClick = (f) => {
        if (selectedFile?.name === f.name) return;
        if (hasUnsaved) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.unsaved.title'),
                message: t('modal.unsaved.message'),
                confirmLabel: t('modal.unsaved.confirm'),
                cancelLabel: t('modal.unsaved.cancel'),
                onConfirm: () => selectFile(f)
            });
            return;
        }
        selectFile(f);
    };

    return (
        <>
            <LayoutContent
                header={<Header title={t('app.title')} />}
                content={
                    <div data-cy="osgi-config-manager" style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: '16px', gap: '16px', minWidth: 0 }}>
                        {/* LEFT PANE: File List */}
                        <FileSidebar
                            files={files}
                            selectedFile={selectedFile}
                            handleFileClick={handleFileClick}
                            handleToggleFile={handleToggleFile}
                            handleDeleteFile={handleDeleteFile}
                            handleCreateFile={handleCreateFile}
                            handleOpenCreateDialog={handleOpenCreateDialog}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            setModalConfig={setModalConfig}
                            handleUploadFile={handleUploadFile}
                            rawContent={rawContent}
                            hasUnsaved={hasUnsaved}
                            searchInContent={searchInContent}
                            setSearchInContent={setSearchInContent}
                        />

                        {/* RIGHT PANE: Editor */}
                        <Paper style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden', minWidth: 0, marginTop: 0 }}>
                            {!selectedFile ? (
                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', color: '#666' }}>
                                    <Typography variant="heading">{t('app.selectConfig')}</Typography>
                                    {loadingFiles && <InlineLoader label={t('app.loadingFiles')} />}
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '56px', marginBottom: '12px', borderBottom: '1px solid var(--color-gray_light40)', paddingBottom: '12px' }}>
                                        <div>
                                            <div data-cy="selected-file-name">
                                                <Typography variant="heading">{selectedFile.name}</Typography>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                <Typography variant="caption" color="textSecondary">{selectedFile.path}</Typography>
                                                <ConfigStateBadge state={selectedConfigState} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            {hasUnsaved && <Typography variant="caption" color="warning" weight="bold">{t('app.unsaved')}</Typography>}
                                            {canMarkAsDefault && (
                                                <div data-cy="mark-as-default-button">
                                                    <Tooltip label={t('tooltip.markAsDefault')}>
                                                        <Button
                                                            label={t('app.markAsDefault')}
                                                            variant="outlined"
                                                            onClick={() => handleMarkAsDefault(selectedFile)}
                                                            disabled={hasUnsaved}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            )}
                                            {/* Toggle Raw/Visual Mode for .cfg files */}
                                            {(selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled')) && (
                                                <div data-cy="editor-mode-toggle" data-mode={isRawMode ? 'raw' : 'visual'}>
                                                    <Tooltip label={isRawMode ? t('tooltip.modeVisual') : t('tooltip.modeRaw')}>
                                                        <Button
                                                            label={isRawMode ? t('editor.button.modeVisual') : t('editor.button.modeRaw')}
                                                            variant="outlined"
                                                            icon={isRawMode ? <ViewList style={{ width: '16px', height: '16px' }} /> : <Code style={{ width: '16px', height: '16px' }} />}
                                                            onClick={handleToggleRawMode}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            )}
                                            <div data-cy="save-config-button">
                                                <Tooltip label={t('tooltip.save')}>
                                                    <Button
                                                        label={t('app.save')}
                                                        color="accent"
                                                        icon={<Save style={{ width: '16px', height: '16px' }} />}
                                                        onClick={() => handleSave()}
                                                        // Enable save if hasUnsaved changes. 
                                                        // Only block on isYamlValid if we are in Raw Mode (or YAML file).
                                                        // In Visual Mode (CfgEditor), we perform our own validation on save.
                                                        disabled={!hasUnsaved || ((isRawMode || selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) && !isYamlValid)}
                                                    />
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <div style={{ marginBottom: '20px', padding: '10px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Warning size="small" style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                                            <Typography color="danger">{error}</Typography>
                                        </div>
                                    )}

                                    {!error && selectedConfigState === 'MODULE' && (
                                        <div
                                            data-cy="config-state-module-warning"
                                            style={{
                                                marginBottom: '20px',
                                                padding: '10px 12px',
                                                background: '#fff7ed',
                                                border: '1px solid #fed7aa',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}
                                        >
                                            <Warning size="small" style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                                            <Typography>{t('configState.banner.module')}</Typography>
                                        </div>
                                    )}

                                    {!error && selectedConfigState === 'MODULE_DEFAULT' && (
                                        <div
                                            data-cy="config-state-module-default-info"
                                            style={{
                                                marginBottom: '20px',
                                                padding: '10px 12px',
                                                background: '#eef8fd',
                                                border: '1px solid #b6e0f2',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            <Typography>{t('configState.banner.moduleDefault')}</Typography>
                                        </div>
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
                                                            onSwitchMode={handleToggleRawMode}
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
                                                            showComments={showComments}
                                                            handleToggleComments={handleToggleComments}
                                                            setShowComments={setShowComments}
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
            {`@keyframes osgi-config-manager-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
        </style>
        <AppContent />
    </ToastProvider>
);

export default App;
