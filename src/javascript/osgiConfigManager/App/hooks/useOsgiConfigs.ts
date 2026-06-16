import { useState, useEffect, useCallback, useRef } from 'react';
import { parseData } from '../utils/configUtils';
import { useTranslation } from 'react-i18next';
import { OsgiMetatypeDefinition, osgiService } from '../api/osgiService';
import { useToast } from './useToast';
import { useProperties } from './useProperties';
import { decryptTree, encryptTree } from '../utils/cryptoTree';
import { useFileActions } from './useFileActions';
import { OsgiFile, ModalConfig, DiffConfig } from './osgiTypes';

export const detectConfigStateFromRawContent = (content: string): 'MODULE' | 'MODULE_DEFAULT' | 'USER' => {
    const lines = (content || '').split(/\r?\n/);
    for (const line of lines) {
        const lowered = line.trim().toLowerCase();
        if (lowered.startsWith('# do not edit')) {
            return 'MODULE';
        }
        if (lowered.startsWith('# default configuration')) {
            return 'MODULE_DEFAULT';
        }
    }

    return 'USER';
};


export const useOsgiConfigs = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const { success, error: toastError, warning: toastWarning } = useToast();
    const [files, setFiles] = useState<OsgiFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<OsgiFile | null>(null);
    const {
        properties,
        collapsedPaths,
        handlePropUpdate,
        handleAddProperty: addProperty,
        handleAddItem: addItem,
        handleDeleteProperty: deleteProperty,
        handleAddCfgEntry,
        handleReorder,
        toggleCollapse,
        resetProperties,
        handleToggleEncryption
    } = useProperties();

    const [originalProperties, setOriginalProperties] = useState<any>({});
    const [rawContent, setRawContent] = useState<string>('');
    const [originalRawContent, setOriginalRawContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
    const [loadingFile, setLoadingFile] = useState<boolean>(false);
    const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
    const [newFileName, setNewFileName] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [diffConfig, setDiffConfig] = useState<DiffConfig>({ isOpen: false, originalContent: '', newContent: '', filename: '', onConfirm: () => { } });
    const [isYamlValid, setIsYamlValid] = useState<boolean>(true);
    const [metatypeInfo, setMetatypeInfo] = useState<OsgiMetatypeDefinition | null>(null);

    const hasUnsaved = JSON.stringify(properties) !== JSON.stringify(originalProperties) || rawContent !== originalRawContent;

    // Guard against losing edits to a tab close / reload / browser navigation. In-app navigation is
    // already protected by runWithUnsavedConfirmation; this covers the cases React cannot intercept.
    useEffect(() => {
        if (!hasUnsaved) {
            return undefined;
        }
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsaved]);

    const [searchInContent, setSearchInContent] = useState<boolean>(false);
    const [visualFormattingControlsEnabled, setVisualFormattingControlsEnabled] = useState<boolean>(false);

    const fetchFiles = useCallback(async (query: string = '', deep: boolean = false) => {
        setLoadingFiles(true);
        try {
            const data = await osgiService.getAll(query, deep);
            if (data.uiConfig) {
                setVisualFormattingControlsEnabled(Boolean(data.uiConfig.visualFormattingControlsEnabled));
            }
            if (data.files) {
                setFiles(data.files);
                setSelectedFile(previous => {
                    if (!previous) {
                        return previous;
                    }

                    const matchingFile = data.files?.find(file => file.name === previous.name);
                    if (!matchingFile) {
                        return previous;
                    }

                    const nextConfigState = matchingFile.configState || previous.configState;
                    if (matchingFile.enabled === previous.enabled && nextConfigState === previous.configState) {
                        return previous;
                    }

                    return {
                        ...previous,
                        enabled: matchingFile.enabled,
                        configState: nextConfigState
                    };
                });
            }
        } catch (e: any) {
            setError(e.message);
        }
        setLoadingFiles(false);
    }, []);

    const fetchFileContent = useCallback(async (filename: string) => {
        setLoadingFile(true);
        setError(null); // Clear previous errors
        setMetatypeInfo(null);
        try {
            const data = await osgiService.read(filename);
            if (data.data) {
                setMetatypeInfo(data.data.metatype || null);
                setSelectedFile(prev => {
                    if (!prev || prev.name !== filename) {
                        return prev;
                    }

                    const nextConfigState = data.data?.configState || prev.configState;
                    if (prev.configState === nextConfigState) {
                        return prev;
                    }

                    return {
                        ...prev,
                        configState: nextConfigState
                    };
                });
                // Standardization: For .cfg files, we MUST use the client-side parser (parseCfgContent)
                // on the rawContent to ensure that the structure matches exactly what handleToggleRawMode produces.
                // Using the server-side 'properties' often leads to structural differences (e.g. comments, type wrappers)
                // causing false "Unsaved Changes" flags.
                const isCfg = filename.toLowerCase().endsWith('.cfg');
                let parsed: any;

                if (isCfg && data.data.rawContent) {
                    const { parseCfgContent } = await import('../utils/configUtils');
                    parsed = parseCfgContent(data.data.rawContent);
                } else if (data.data.properties) {
                    // Fallback for YML or if rawContent missing
                    parsed = parseData(data.data.properties);
                } else {
                    parsed = {};
                }

                // Decrypt ENC(...) leaf values in place (decrypt-in-memory model). Surface a toast
                // if any value could not be decrypted so the user is not misled into thinking a
                // displayed/blank value is the real secret.
                let decryptFailed = false;
                await decryptTree(parsed, filename, () => { decryptFailed = true; });
                if (decryptFailed) {
                    toastError(t('notification.decryptError'));
                }

                resetProperties(parsed);
                setOriginalProperties(JSON.parse(JSON.stringify(parsed)));

                // Note: rawContent is strictly what comes from file (Encrypted). 
                // We do NOT update rawContent to match decrypted tree here, 
                // because rawContent represents Text Mode (which must remain Encrypted).
                setRawContent(data.data.rawContent || '');
                setOriginalRawContent(data.data.rawContent || '');
            } else {
                setMetatypeInfo(null);
                resetProperties({});
                setOriginalProperties({});
                setRawContent('');
                setOriginalRawContent('');
            }
        } catch (e: any) {
            setError(e.message);
            setMetatypeInfo(null);
            // If we have an error (e.g. blacklisted), refresh the files list to sync Sidebar
            fetchFiles();
        }
        setLoadingFile(false);
    }, [fetchFiles, resetProperties, t, toastError]);

    const prevSearchInContent = useRef(searchInContent);

    // Debounce search when in Deep Search mode
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInContent) {
                fetchFiles(searchTerm, true);
            } else {
                // If we just switched FROM deep search (true -> false), reload all files
                // OR if we haven't loaded any files yet (initial load), fetch them.
                if (prevSearchInContent.current === true || files.length === 0) {
                    fetchFiles();
                }
            }
            prevSearchInContent.current = searchInContent;
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchFiles, searchInContent, searchTerm, files.length]);

    const selectFile = useCallback((file: OsgiFile | null) => {
        setSelectedFile(file);
        if (file?.name) {
            void fetchFileContent(file.name);
        } else {
            setMetatypeInfo(null);
            resetProperties({});
            setOriginalProperties({});
            setRawContent('');
            setOriginalRawContent('');
            setError(null);
            setLoadingFile(false);
        }
    }, [fetchFileContent, resetProperties]);



    // ... (rest of state)

    const [isRawMode, setIsRawMode] = useState<boolean>(true);
    const [showCommentsPreference, setShowCommentsPreference] = useState<boolean>(false);
    const [showEmptyLinesPreference, setShowEmptyLinesPreference] = useState<boolean>(false);

    // Initial load of user preferences
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const [modeData, commentsData, emptyLinesData] = await Promise.all([
                    osgiService.getPreference('osgiEditorMode'),
                    osgiService.getPreference('osgiShowComments'),
                    osgiService.getPreference('osgiShowEmptyLines')
                ]);

                if (modeData.value) {
                    setIsRawMode(modeData.value === 'raw');
                }
                if (commentsData.value) {
                    setShowCommentsPreference(commentsData.value === 'true');
                }
                if (emptyLinesData.value) {
                    setShowEmptyLinesPreference(emptyLinesData.value === 'true');
                }
            } catch (e) {
                console.error("Failed to load user preferences", e);
            }
        };
        loadPreferences();
    }, []);

    const showComments = visualFormattingControlsEnabled && showCommentsPreference;
    const showEmptyLines = visualFormattingControlsEnabled && showEmptyLinesPreference;

    // Persist already-computed content to disk and refresh state. Called after the user confirms
    // the diff (or directly when there is nothing to review).
    const persistContent = useCallback(async (finalContent: string) => {
        if (!selectedFile) return;

        try {
            await osgiService.save({
                action: 'save',
                filename: selectedFile.name,
                rawContent: finalContent
            });
            success(t('notification.saveSuccess'));

            // Update origins
            if (isRawMode) {
                setOriginalRawContent(finalContent);

                const { parseCfgContent } = await import('../utils/configUtils');
                if (selectedFile?.name.endsWith('.cfg') || selectedFile?.name.endsWith('.cfg.disabled')) {
                    const parsed = parseCfgContent(finalContent);
                    await decryptTree(parsed, selectedFile?.name ?? '');

                    resetProperties(parsed);
                    setOriginalProperties(JSON.parse(JSON.stringify(parsed)));
                }

            } else {
                setOriginalProperties(JSON.parse(JSON.stringify(properties)));
                setOriginalRawContent(finalContent || '');
                setRawContent(finalContent || '');
            }

            const nextConfigState = detectConfigStateFromRawContent(finalContent || '');
            setSelectedFile(previous => previous && previous.name === selectedFile.name ? {
                ...previous,
                configState: nextConfigState
            } : previous);
            setFiles(previous => previous.map(file => file.name === selectedFile.name ? {
                ...file,
                configState: nextConfigState
            } : file));

            await fetchFiles();
            await fetchFileContent(selectedFile.name);

        } catch (e: any) {
            toastError(e.message);
        }
    }, [isRawMode, selectedFile, properties, t, success, toastError, resetProperties, fetchFiles, fetchFileContent]);

    // Compute the content that would be written, running the same validation gates as before.
    // Returns null when validation fails (a modal is shown) so the caller aborts.
    const computeFinalContent = useCallback(async (): Promise<string | null> => {
        if (isRawMode) {
            return rawContent;
        }

        if ((selectedFile?.name.endsWith('.yml') || selectedFile?.name.endsWith('.yml.disabled')) && !isYamlValid) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.invalidYaml'),
                cancelLabel: t('modal.ok'),
                confirmLabel: null
            });
            return null;
        }

        // Check for duplicates (if Array)
        if (Array.isArray(properties)) {
            const seenKeys = new Set();
            const duplicateKeys = new Set();
            properties.forEach((entry: any) => {
                const type = entry.type?.value || entry.type;
                const key = entry.key?.value || entry.key;
                if (type === 'property' && key) {
                    if (seenKeys.has(key)) {
                        duplicateKeys.add(key);
                    }
                    seenKeys.add(key);
                }
            });

            if (duplicateKeys.size > 0) {
                setModalConfig({
                    type: 'alert',
                    title: t('modal.error.title'),
                    message: t('modal.error.duplicateKeys', { keys: Array.from(duplicateKeys).join(', ') }) || `Duplicate keys found: ${Array.from(duplicateKeys).join(', ')}`
                });
                return null;
            }
        }

        // Encrypt before serializing (decrypted-in-memory model). If any value fails to encrypt
        // (e.g. no encryption key configured server-side), abort the save rather than silently
        // persisting a secret as plaintext.
        let encryptFailed = false;
        const propsToSave = await encryptTree(JSON.parse(JSON.stringify(properties)), () => { encryptFailed = true; });
        if (encryptFailed) {
            toastError(t('notification.encryptError'));
            return null;
        }

        if (Array.isArray(propsToSave)) {
            const { toCfgFormat } = await import('../utils/configUtils');
            return toCfgFormat(propsToSave);
        }
        if (selectedFile?.name.endsWith('.yml') || selectedFile?.name.endsWith('.yml.disabled')) {
            // YAML is edited as raw text; rely on the raw editor content.
            return rawContent;
        }
        const { prepareDataForSave, toCfgFormat } = await import('../utils/configUtils');
        const prepared = await prepareDataForSave(propsToSave);
        return toCfgFormat(prepared);
    }, [isRawMode, rawContent, selectedFile, isYamlValid, properties, t, toastError]);

    const handleSave = useCallback(async () => {
        if (!selectedFile) return;

        const finalContent = await computeFinalContent();
        if (finalContent === null) {
            return; // validation failed; a modal was shown
        }

        const original = originalRawContent;
        if (finalContent === original) {
            // Nothing changed — persist directly rather than showing an empty diff.
            await persistContent(finalContent);
            return;
        }

        // Review-before-save: show the diff of on-disk vs new content; persist only on confirm.
        setDiffConfig({
            isOpen: true,
            originalContent: original,
            newContent: finalContent,
            filename: selectedFile.name,
            onConfirm: () => {
                setDiffConfig(prev => ({ ...prev, isOpen: false }));
                void persistContent(finalContent);
            }
        });
    }, [selectedFile, computeFinalContent, originalRawContent, persistContent]);

    const handleToggleComments = useCallback(async () => {
        if (!visualFormattingControlsEnabled) {
            return;
        }

        const newValue = !showCommentsPreference;
        setShowCommentsPreference(newValue);

        try {
            await osgiService.setPreference('osgiShowComments', String(newValue));
        } catch (e) {
            console.error("Failed to save comment visibility preference", e);
        }
    }, [showCommentsPreference, visualFormattingControlsEnabled]);

    const handleToggleEmptyLines = useCallback(async () => {
        if (!visualFormattingControlsEnabled) {
            return;
        }

        const newValue = !showEmptyLinesPreference;
        setShowEmptyLinesPreference(newValue);

        try {
            await osgiService.setPreference('osgiShowEmptyLines', String(newValue));
        } catch (e) {
            console.error("Failed to save empty line visibility preference", e);
        }
    }, [showEmptyLinesPreference, visualFormattingControlsEnabled]);

    const handleToggleRawMode = useCallback(async () => {
        // Capture cleanliness state before toggle
        const wasClean = !hasUnsaved;
        const newMode = !isRawMode;

        if (isRawMode) {
            // Switching TO Visual Mode
            const { parseCfgContent } = await import('../utils/configUtils');
            const parsed = parseCfgContent(rawContent); // This will have ENC(...) values

            // Decrypt-in-Memory: Decrypt all ENC values
            let decryptFailed = false;
            await decryptTree(parsed, selectedFile?.name ?? '', () => { decryptFailed = true; });
            if (decryptFailed) {
                toastError(t('notification.decryptError'));
            }

            resetProperties(parsed);

            // Rebaseline if we were clean (ignore distinct parsing artifacts)
            if (wasClean) {
                setOriginalProperties(JSON.parse(JSON.stringify(parsed)));
            }

        } else {
            // Switching TO Raw Mode
            const { toCfgFormat, prepareDataForSave } = await import('../utils/configUtils');

            // Force Synchronization: Always regenerate rawContent from properties.
            // Previous optimization using isDeepEqual caused data loss scenarios (e.g. new files)
            // or state desync. It is safer to always serialize the current state.

            // 1. Encrypt properties
            // We clone properties to avoid mutating the Visual State
            let encryptFailed = false;
            const propsToEnc = await encryptTree(JSON.parse(JSON.stringify(properties)), () => { encryptFailed = true; });
            if (encryptFailed) {
                // Fail closed: encryptTree leaves any leaf it could not encrypt as plaintext. Abort the
                // switch so that plaintext stays only in the in-memory visual state and is never
                // serialized into rawContent (and from there persisted to disk). The user remains in
                // visual mode with their secrets intact.
                toastError(t('notification.encryptError'));
                return;
            }

            // 2. Convert to String
            let formatted = '';

            if (Array.isArray(propsToEnc)) {
                formatted = toCfgFormat(propsToEnc);
            } else {
                const prepared = await prepareDataForSave(propsToEnc);
                formatted = toCfgFormat(prepared);
            }

            // Detect non-equivalent reserialization: regenerating from the property tree can rewrite
            // hand-authored comments, key ordering, and spacing. Warn before silently re-baselining
            // a clean file so the user knows formatting may have changed.
            if (wasClean && formatted !== rawContent) {
                toastWarning(t('notification.reserializeWarning'));
            }

            setRawContent(formatted);

            // Rebaseline if we were clean (ignore formatting changes)
            if (wasClean) {
                setOriginalRawContent(formatted);
            }
        }
        setIsRawMode(newMode);

        // Persist the editor-mode preference only after the switch has actually completed. Persisting
        // it up front left osgiEditorMode='raw' even when encryption failed and we aborted the switch
        // (the fail-closed return above), so a reload would wrongly initialize in raw mode.
        try {
            await osgiService.setPreference('osgiEditorMode', newMode ? 'raw' : 'visual');
        } catch (e) {
            console.error("Failed to save user preference", e);
        }
    }, [hasUnsaved, isRawMode, rawContent, properties, resetProperties, selectedFile, t, toastError, toastWarning]);

    const handleSetEditorMode = useCallback(async (mode: 'raw' | 'visual') => {
        const shouldBeRaw = mode === 'raw';
        if (shouldBeRaw === isRawMode) {
            return;
        }

        await handleToggleRawMode();
    }, [handleToggleRawMode, isRawMode]);

    const handleCancelChanges = useCallback(async () => {
        if (!selectedFile?.name) {
            return;
        }

        await fetchFileContent(selectedFile.name);
    }, [fetchFileContent, selectedFile]);

    const handleRefreshFiles = useCallback(async () => {
        if (searchInContent) {
            await fetchFiles(searchTerm, true);
        } else {
            await fetchFiles();
        }

        if (selectedFile?.name) {
            await fetchFileContent(selectedFile.name);
        }
    }, [fetchFileContent, fetchFiles, searchInContent, searchTerm, selectedFile]);

    const {
        handleToggleFile,
        handleDeleteFile,
        handleMarkAsDefault,
        handleCreateFile,
        handleOpenCreateDialog,
        handleUploadFile
    } = useFileActions({
        files,
        selectedFile,
        fetchFiles,
        fetchFileContent,
        selectFile,
        setSelectedFile,
        setModalConfig
    });

    const handleRawUpdate = useCallback((val: string) => {
        setRawContent(val);
    }, []);

    const handleAddItem = useCallback((path: (string | number)[]) => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.addItem.title'),
            message: t('modal.addItem.message'),
            onConfirm: (val) => addItem(path, val)
        });
    }, [addItem, t]);

    const handleAddProperty = useCallback((path: (string | number)[]) => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.addProp.title'),
            message: t('modal.addProp.message'),
            onConfirm: (key) => {
                const onError = (msg: string) => {
                    setTimeout(() => {
                        setModalConfig({
                            type: 'confirm',
                            severity: 'warning',
                            title: t('modal.error.title'),
                            message: msg,
                            cancelLabel: t('modal.ok'),
                            confirmLabel: null
                        });
                    }, 100);
                };
                addProperty(path, key, onError);
            }
        });
    }, [addProperty, t]);

    const handleDeleteProperty = useCallback((path: (string | number)[]) => {
        const key = path[path.length - 1];
        let displayName = String(key);

        if (Array.isArray(properties) && typeof key === 'number') {
            const items = properties;
            if (items[key] && items[key].key && items[key].key.value) {
                displayName = items[key].key.value;
            } else if (items[key] && items[key].type) {
                const typeVal = items[key].type.value || items[key].type;
                if (typeVal === 'comment') {
                    displayName = t('editor.button.addComment');
                } else if (typeVal === 'empty') {
                    displayName = t('editor.button.addEmptyLine');
                }
            }
        }

        setModalConfig({
            type: 'confirm',
            title: t('modal.deleteProp.title'),
            message: t('modal.deleteProp.message', { name: displayName }),
            onConfirm: () => deleteProperty(path)
        });
    }, [deleteProperty, properties, t]);

    return {
        files,
        selectedFile,
        setSelectedFile,
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
        handleUploadFile,
        handlePropUpdate,
        handleRawUpdate,
        handleAddProperty,
        handleAddItem,
        handleDeleteProperty,
        handleAddCfgEntry,
        handleReorder,
        toggleCollapse,
        searchTerm,
        setSearchTerm,
        modalConfig,
        setModalConfig,
        diffConfig,
        setDiffConfig,
        apiUrl: osgiService.url,
        isYamlValid,
        setIsYamlValid,
        searchInContent,
        setSearchInContent,
        fetchFiles,
        isRawMode,
        handleToggleRawMode,
        handleSetEditorMode,
        handleCancelChanges,
        handleRefreshFiles,
        visualFormattingControlsEnabled,
        showComments,
        setShowComments: setShowCommentsPreference,
        handleToggleComments,
        showEmptyLines,
        setShowEmptyLines: setShowEmptyLinesPreference,
        handleToggleEmptyLines,
        handleToggleEncryption
    };
};
