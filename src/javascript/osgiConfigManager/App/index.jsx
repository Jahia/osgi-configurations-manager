import React from 'react';
import {
    LayoutContent,
    Paper,
    Typography
} from '@jahia/moonstone';
import { useOsgiConfigs } from './hooks/useOsgiConfigs';
import {
    APP_LAYOUT_STYLE,
    EDITOR_PANE_FLEX,
    EMPTY_STATE_STYLE,
    InlineLoader,
    PANEL_STYLE,
    StatusBanner,
    VISUALLY_HIDDEN_STYLE
} from './components/AppChrome';
import { FileSidebar } from './components/FileSidebar';
import { CfgEditor } from './components/CfgEditor';
import { MonacoEditor } from './components/MonacoEditor';
import { ModalDialog } from './components/Dialogs';
import { DiffModal } from './components/DiffModal';
import { SelectedFileHeader } from './components/SelectedFileHeader';
import { SelectedFileToolbar } from './components/SelectedFileToolbar';
import { AppHeaderBar } from './components/AppHeaderBar';
import { useTranslation } from 'react-i18next';
import { ToastProvider } from './hooks/useToast';
import { configFileKind } from './utils/configIdentity';

// A load is announced only once it has lasted this long: every arrow key in the file list and every
// deep-search keystroke loads, and would speak over the file name or the typing.
const LOAD_ANNOUNCE_DELAY_MS = 1000;

// What the editor pane's status region says: a save at once, as it follows an explicit action, a
// load only once it lasts. Saving wins, and lasts through the reload that follows the save, so that
// the save's own notification is the only new message when it ends.
const usePaneStatus = (t, {isSaving, loadingFile, loadingFiles}) => {
    const loadLabel = loadingFile ? t('app.loadingFile') : (loadingFiles ? t('app.loadingFiles') : '');
    const [announcedLoad, setAnnouncedLoad] = React.useState('');
    React.useEffect(() => {
        if (!loadLabel) {
            setAnnouncedLoad('');
            return undefined;
        }
        const timer = window.setTimeout(() => setAnnouncedLoad(loadLabel), LOAD_ANNOUNCE_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [loadLabel]);
    return isSaving ? t('app.saving') : announcedLoad;
};

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
        isSaving,
        showKeyProblems,
        keyProblemsFocusRequest,
        error,
        isCreatingFile,
        setIsCreatingFile,
        newFileName,
        setNewFileName,
        handleSave,
        handleToggleFile,
        handleDeleteFile,
        handleMarkAsDefault,
        handleOpenCreateDialog,
        handlePropUpdate,
        handleRawUpdate,
        handleDeleteProperty,
        searchTerm,
        setSearchTerm,
        modalConfig,
        setModalConfig,
        diffConfig,
        setDiffConfig,
        isYamlValid,
        validationErrors,
        handleEditorValidate,
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
    const selectedKind = selectedFile ? configFileKind(selectedFile.name) : null;
    const paneStatus = usePaneStatus(t, {isSaving, loadingFile, loadingFiles});
    const isConfigFile = Boolean(selectedKind);
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
                            loadingFiles={loadingFiles}
                        />

                        {/* RIGHT PANE: Editor */}
                        <Paper style={{ ...PANEL_STYLE, ...EDITOR_PANE_FLEX, height: '100%', overflow: 'hidden', marginTop: 0 }}>
                            {/* Outside both branches below, so that it exists before its first text: a
                                region mounted together with its text is not announced (WCAG 4.1.3). No
                                aria-busy around it, which makes screen readers hold back live updates. */}
                            <div data-cy="editor-pane-status" role="status" style={VISUALLY_HIDDEN_STYLE}>{paneStatus}</div>
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
                                        validationErrors={validationErrors}
                                        isSaving={isSaving}
                                        onSave={() => handleSave()}
                                        onCancel={handleCancelClick}
                                    />

                                    {/* Live regions mounted before their text, and empty while the file loads, so
                                        that a failed load and the Module warning are announced when they appear.
                                        The Module-default note only reassures, and stays out of them. */}
                                    <div data-cy="file-alert-region" role="alert">
                                        {!loadingFile && error && <StatusBanner tone="error" message={error} />}
                                    </div>

                                    <div data-cy="file-status-region" role="status">
                                        {!loadingFile && !error && selectedConfigState === 'MODULE' && (
                                            <StatusBanner
                                                tone="warning"
                                                dataCy="config-state-module-warning"
                                                message={t('configState.banner.module')}
                                            />
                                        )}
                                    </div>

                                    {!loadingFile && !error && selectedConfigState === 'MODULE_DEFAULT' && (
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
                                            isLoadingFile={loadingFile}
                                        />
                                    )}

                                    {/* 4px of padding, given back by the margin: the hidden overflow cut the outer 4px
                                        of focus rings (2px ring, 2px offset) at its edges. */}
                                    <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '4px', margin: '4px -4px -4px', minWidth: 0 }}>
                                        {loadingFile ? (
                                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                                <InlineLoader label={t('app.loadingFile')} />
                                            </div>
                                        ) : (
                                            <>
                                                {selectedKind === 'yml' ? (
                                                    <MonacoEditor
                                                        value={rawContent}
                                                        onChange={handleRawUpdate}
                                                        onValidate={handleEditorValidate}
                                                        metatypeDefinition={metatypeInfo}
                                                        filename={selectedFile.name}
                                                    />
                                                ) : selectedKind === 'cfg' ? (
                                                    isRawMode ? (
                                                        <MonacoEditor
                                                            value={rawContent}
                                                            onChange={handleRawUpdate}
                                                            onValidate={handleEditorValidate}
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
                                                            showKeyProblems={showKeyProblems}
                                                            keyProblemsFocusRequest={keyProblemsFocusRequest}
                                                        />
                                                    )
                                                ) : null}
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
                metatypeDefinition={metatypeInfo}
            />
        </>
    );
};

const App = () => (
    <ToastProvider>
        <style>
            {`
                @keyframes osgi-config-manager-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .osgi-spinner {
                    animation: osgi-config-manager-spin 0.8s linear infinite;
                }
                /* Prefers-reduced-motion: no slide-in, no transition, a still spinner (its label says
                   it is loading). !important, as most of these are inline styles. */
                @media (prefers-reduced-motion: reduce) {
                    :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"], [data-cy="toast-host"]),
                    :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"], [data-cy="toast-host"]) * {
                        animation: none !important;
                        transition: none !important;
                    }
                }
                .osgi-cfg-field:focus {
                    outline: none;
                }
                .osgi-cfg-field:focus-visible {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: 1px;
                }
                .osgi-scroll-region:focus {
                    outline: none;
                }
                .osgi-scroll-region:focus-visible {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: 2px;
                }
                .osgi-file-list:focus {
                    outline: none;
                }
                /* With a white inner ring: the selected row is accent_dark too, and the ring vanished
                   where it crossed it. */
                .osgi-file-list:focus-visible {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: -2px;
                    box-shadow: inset 0 0 0 4px var(--color-white);
                }
                /* The selected file was white on Moonstone's accent, 2.94:1 (WCAG 1.4.3): accent_dark,
                   5.2:1, hovered or not. In forced colours, where backgrounds go, the system's own
                   selection colours. */
                .osgi-file-list .moonstone-TableRow.moonstone-TableRow-highlighted.moonstone-TableRow-highlighted,
                .osgi-file-list .moonstone-TableRow.moonstone-TableRow-highlighted.moonstone-TableRow-highlighted:is(:hover, :focus-within) {
                    background-color: var(--color-accent_dark);
                }
                @media (forced-colors: active) {
                    .osgi-file-list .moonstone-TableRow.moonstone-TableRow-highlighted {
                        forced-color-adjust: none;
                        background-color: Highlight;
                        color: HighlightText;
                    }
                    .osgi-file-list .moonstone-TableRow.moonstone-TableRow-highlighted * {
                        color: HighlightText !important;
                        border-color: HighlightText !important;
                    }
                    /* The visual editor's selected row: its bar, in the system's selection colour. */
                    .osgi-cfg-table [data-selected="true"] {
                        border-left-color: Highlight !important;
                    }
                }
                /* Moonstone's accent and danger buttons were under 4.5:1: white on accent 2.94:1 (Save,
                   the dialogs' confirm), white on danger 3.68:1 (Delete), accent on white 2.94:1 (Add
                   Property). The dark tones give 5.2:1 and 10.3:1. Unavailable buttons keep their grey.
                   Moonstone 2.19+ says variant and colour in data attributes; the one served by older
                   Jahia 8.2 (8.2.3.2) only in classes (moonstone-button_accent for a filled accent
                   button, moonstone-button_outlined_accent, moonstone-button_ghost...), so both are
                   matched. */
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="default"][data-color="accent"], .moonstone-button_accent):not(:disabled):not([aria-disabled="true"]) {
                    background-color: var(--color-accent_dark);
                    border-color: var(--color-accent_dark);
                    color: var(--color-white);
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="default"][data-color="accent"], .moonstone-button_accent):not(:disabled):not([aria-disabled="true"]):is(:hover, :active) {
                    background-color: var(--color-accent_dark_contrast);
                    border-color: var(--color-accent_dark_contrast);
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="default"][data-color="danger"], .moonstone-button_danger):not(:disabled):not([aria-disabled="true"]) {
                    background-color: var(--color-danger_dark);
                    border-color: var(--color-danger_dark);
                    color: var(--color-white);
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="default"][data-color="danger"], .moonstone-button_danger):not(:disabled):not([aria-disabled="true"]):is(:hover, :active) {
                    background-color: color-mix(in srgb, var(--color-danger_dark) 80%, black);
                    border-color: color-mix(in srgb, var(--color-danger_dark) 80%, black);
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="outlined"][data-color="accent"], .moonstone-button_outlined_accent):not(:disabled):not([aria-disabled="true"]) {
                    color: var(--color-accent_dark);
                    border-color: var(--color-accent_dark);
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-button.moonstone-button:is([data-variant="outlined"][data-color="accent"], .moonstone-button_outlined_accent):not(:disabled):not([aria-disabled="true"]):is(:hover, :active) {
                    background-color: var(--color-accent_light_plain20);
                }
                /* Moonstone's tabs (the Create dialog's Manual / Configuration / Factory) are gray,
                   3.95:1, and accent when selected, 2.89:1 (WCAG 1.4.3). */
                .moonstone-tabItem:not(.moonstone-reverse) {
                    color: var(--color-gray_dark);
                }
                .moonstone-tabItem.moonstone-tabItem_selected:not(.moonstone-reverse) {
                    color: var(--color-accent_dark);
                }
                /* Moonstone draws focus in accent_light, 1.74:1 on white (WCAG 1.4.11): the module's
                   own parts and dialogs use accent_dark, 5.2:1. Only the colour changes, so the states
                   where Moonstone hides the ring keep it hidden. Doubled classes outweigh Moonstone's
                   variant rules, (0,4,0) in 2.19 and 2.21. */
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    :is(.moonstone-button.moonstone-button, .moonstone-tabItem.moonstone-tabItem, .moonstone-checkbox_input.moonstone-checkbox_input,
                        .moonstone-checkboxItem.moonstone-checkboxItem, .moonstone-dropdown.moonstone-dropdown, .moonstone-textarea.moonstone-textarea):focus-visible:not(:disabled) {
                    outline-color: var(--color-accent_dark);
                }
                /* Inputs ring their bordered wrapper. */
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"], [data-cy="modal-dialog"], [data-cy="diff-modal"], [data-cy="cfg-metatype-property-dialog"])
                    .moonstone-baseInput.moonstone-baseInput:has(input:focus-visible) {
                    outline-color: var(--color-accent_dark);
                }
                /* The switch drew a 2px border inside its track, 1.24:1 and half under the knob: ring the
                   whole switch instead. */
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"]) .moonstone-switch_input.moonstone-switch_input:focus-visible {
                    border: 0;
                }
                :is([data-cy="osgi-config-manager"], [data-cy="app-header"]) .moonstone-switch:has(> .moonstone-switch_input:focus-visible) {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: 2px;
                    border-radius: 12px;
                }
                /* The visual editor's own icon buttons (drag handle, Metatype info) had the browser's ring. */
                .osgi-cfg-icon-button:focus {
                    outline: none;
                }
                .osgi-cfg-icon-button:focus-visible {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: 2px;
                    border-radius: 4px;
                }
                /* Moonstone's body cells clip their content (an overflow:auto cell around an
                   overflow:hidden text span), which cut every focus ring in the table. The fields wrap
                   and grow, so no body cell needs it. */
                .osgi-cfg-table .moonstone-TableBody .moonstone-tableBodyCell {
                    overflow: visible;
                }
                .osgi-cfg-table .moonstone-TableBody .moonstone-typography.moonstone-nowrap {
                    overflow: visible;
                    white-space: normal;
                    text-overflow: clip;
                }
                .osgi-cfg-table .moonstone-TableCell {
                    padding-left: 8px;
                    padding-right: 8px;
                }
                .osgi-cfg-table thead .moonstone-typography.moonstone-nowrap {
                    white-space: normal;
                }
                /* Monaco shows only its caret when it has the focus: ring the 2px band left around it,
                   where none of its own layers paints over the ring. */
                .osgi-raw-editor-canvas:has(.monaco-editor.focused) {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: -2px;
                }
                /* The radio of a Create option is small and its card scrolls: ring the whole card,
                   inside, as the list would clip an outer ring. */
                .osgi-create-option:has(input:focus-visible) {
                    outline: 2px solid var(--color-accent_dark);
                    outline-offset: -2px;
                }
                /* Save and Cancel stay focusable when unavailable (aria-disabled, not disabled), so that
                   the focus is not dropped when a save or a cancel ends, and so they get Moonstone's
                   :disabled look by hand: grey on light grey at 40% opacity. The opacity is mixed into
                   the colours rather than set on the button, which would fade its focus ring too.
                   !important, as their colours come from rules with more attribute selectors and
                   :hover:not(:disabled). A filled button is one that is neither ghost nor outlined, in
                   both Moonstone forms (see above). */
                .moonstone-button.moonstone-button[aria-disabled="true"] {
                    color: color-mix(in srgb, var(--color-gray_dark) 40%, var(--color-white)) !important;
                    cursor: not-allowed;
                    box-shadow: none !important;
                }
                .moonstone-button.moonstone-button[aria-disabled="true"]:is([data-variant="default"], :not([data-variant]):not([class*="moonstone-button_ghost"]):not([class*="moonstone-button_outlined"])) {
                    border-color: color-mix(in srgb, var(--color-gray_light) 40%, var(--color-white)) !important;
                    background-color: color-mix(in srgb, var(--color-gray_light) 40%, var(--color-white)) !important;
                }
                .moonstone-button.moonstone-button[aria-disabled="true"]:is([data-variant="ghost"], [class*="moonstone-button_ghost"]) {
                    background-color: transparent !important;
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
