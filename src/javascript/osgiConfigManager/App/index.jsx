import React from 'react';
import {
    LayoutContent,
    Header,
    Paper,
    Typography,
    Button,
    Loading,
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
import { useTranslation } from 'react-i18next';
import { ToastProvider } from './hooks/useToast';

const AppContent = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const {
        files,
        selectedFile,
        setSelectedFile,
        properties,
        rawContent,
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
        handleCreateFile,
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
        handleToggleEncryption
    } = useOsgiConfigs();

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
                onConfirm: () => setSelectedFile(f)
            });
            return;
        }
        setSelectedFile(f);
    };

    return (
        <>
            <LayoutContent
                header={<Header title={t('app.title')} />}
                content={
                    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: '10px', gap: '10px', minWidth: 0 }}>
                        {/* LEFT PANE: File List */}
                        <FileSidebar
                            files={files}
                            selectedFile={selectedFile}
                            handleFileClick={handleFileClick}
                            handleToggleFile={handleToggleFile}
                            handleDeleteFile={handleDeleteFile}
                            handleCreateFile={handleCreateFile}
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
                        <Paper style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'hidden', minWidth: 0 }}>
                            {!selectedFile ? (
                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', color: '#666' }}>
                                    <Typography variant="heading">{t('app.selectConfig')}</Typography>
                                    {loadingFiles && <Loading size="medium" />}
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                                        <div>
                                            <Typography variant="heading">{selectedFile.name}</Typography>
                                            <Typography variant="caption" color="textSecondary">{selectedFile.path}</Typography>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            {hasUnsaved && <Typography variant="caption" color="warning" weight="bold">{t('app.unsaved')}</Typography>}
                                            {/* Toggle Raw/Visual Mode for .cfg files */}
                                            {(selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled')) && (
                                                <Button
                                                    label={isRawMode ? t('editor.button.modeVisual') : t('editor.button.modeRaw')}
                                                    variant="outlined"
                                                    icon={isRawMode ? <ViewList /> : <Code />}
                                                    onClick={handleToggleRawMode}
                                                    title={isRawMode ? t('tooltip.modeVisual') : t('tooltip.modeRaw')}
                                                />
                                            )}
                                            <Button
                                                label={t('app.save')}
                                                color="accent"
                                                icon={<Save />}
                                                onClick={() => handleSave()}
                                                // Enable save if hasUnsaved changes. 
                                                // Only block on isYamlValid if we are in Raw Mode (or YAML file).
                                                // In Visual Mode (CfgEditor), we perform our own validation on save.
                                                disabled={!hasUnsaved || ((isRawMode || selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) && !isYamlValid)}
                                                title={t('tooltip.save')}
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div style={{ marginBottom: '20px', padding: '10px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Warning color="danger" />
                                            <Typography color="danger">{error}</Typography>
                                        </div>
                                    )}

                                    <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: '10px', minWidth: 0 }}>
                                        {loadingFile ? (
                                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                                <Loading size="medium" />
                                            </div>
                                        ) : (
                                            <>
                                                {(selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) ? (
                                                    <MonacoEditor
                                                        value={rawContent}
                                                        onChange={handleRawUpdate}
                                                        onValidate={setIsYamlValid}
                                                    />
                                                ) : (selectedFile.name.endsWith('.cfg') || selectedFile.name.endsWith('.cfg.disabled')) ? (
                                                    isRawMode ? (
                                                        <MonacoEditor
                                                            value={rawContent}
                                                            onChange={handleRawUpdate}
                                                            onValidate={setIsYamlValid}
                                                            language="properties"
                                                            onSwitchMode={handleToggleRawMode}
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
        <AppContent />
    </ToastProvider>
);

export default App;
