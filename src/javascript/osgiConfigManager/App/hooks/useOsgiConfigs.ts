import { useState, useEffect, useCallback, useRef } from 'react';
import { parseData } from '../utils/configUtils';
import { useTranslation } from 'react-i18next';
import { osgiService } from '../api/osgiService';
import { useToast } from './useToast';
import { useProperties } from './useProperties';

interface OsgiFile {
    name: string;
    enabled?: boolean;
    [key: string]: any;
}

interface ModalConfig {
    type: 'confirm' | 'prompt' | 'alert';
    severity?: 'warning' | 'info' | 'error';
    title: string;
    message: string;
    defaultValue?: string;
    confirmLabel?: string | null;
    cancelLabel?: string;
    otherLabel?: string;
    onConfirm?: (value?: string) => void;
    onOther?: () => void;
}

interface DiffConfig {
    isOpen: boolean;
    originalContent: string;
    newContent: string;
    filename: string;
    onConfirm: () => void;
}


export const useOsgiConfigs = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const { success, error: toastError } = useToast();
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

    const hasUnsaved = JSON.stringify(properties) !== JSON.stringify(originalProperties) || rawContent !== originalRawContent;

    const [searchInContent, setSearchInContent] = useState<boolean>(false);

    const fetchFiles = useCallback(async (query: string = '', deep: boolean = false) => {
        setLoadingFiles(true);
        try {
            const data = await osgiService.getAll(query, deep);
            if (data.files) {
                setFiles(data.files);
            }
        } catch (e: any) {
            setError(e.message);
        }
        setLoadingFiles(false);
    }, []);

    const fetchFileContent = useCallback(async (filename: string) => {
        setLoadingFile(true);
        try {
            const data = await osgiService.read(filename);
            if (data.data) {
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

                // 2. Decrypt Recursive Helper
                const decryptRecursive = async (obj: any) => {
                    if (Array.isArray(obj)) {
                        await Promise.all(obj.map(item => decryptRecursive(item)));
                    } else if (obj && typeof obj === 'object') {
                        if (obj.isLeaf && obj.encrypted && typeof obj.value === 'string' && obj.value.startsWith('ENC(')) {
                            try {
                                const decData = await osgiService.decrypt(obj.value);
                                obj.value = decData.decryptedValue || obj.value;
                                // Keep encrypted=true flag, but value is now cleartext
                            } catch (e: any) {
                                console.error("Decryption failed for", obj.value, e);
                            }
                        } else {
                            await Promise.all(Object.entries(obj)
                                .filter(([k]) => k !== '_order')
                                .map(([_, v]) => decryptRecursive(v))
                            );
                        }
                    }
                };

                // 3. Perform Decryption
                await decryptRecursive(parsed);

                resetProperties(parsed);
                setOriginalProperties(JSON.parse(JSON.stringify(parsed)));

                // Note: rawContent is strictly what comes from file (Encrypted). 
                // We do NOT update rawContent to match decrypted tree here, 
                // because rawContent represents Text Mode (which must remain Encrypted).
                setRawContent(data.data.rawContent || '');
                setOriginalRawContent(data.data.rawContent || '');
            } else {
                resetProperties({});
                setOriginalProperties({});
                setRawContent('');
                setOriginalRawContent('');
            }
        } catch (e: any) {
            setError(e.message);
        }
        setLoadingFile(false);
    }, []);

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

    useEffect(() => {
        if (selectedFile) {
            // Keep previous mode preference
            // setIsRawMode(false); 
            fetchFileContent(selectedFile.name);
        }
    }, [selectedFile, fetchFileContent]);



    // ... (rest of state)

    const [isRawMode, setIsRawMode] = useState<boolean>(false);

    // Helper to encrypt properties tree before saving/converting to raw
    const encryptRecursive = async (obj: any): Promise<any> => {
        if (Array.isArray(obj)) {
            return Promise.all(obj.map(item => encryptRecursive(item)));
        } else if (obj && typeof obj === 'object') {
            const nextObj = { ...obj };
            // Ensure we only encrypt if it's a leaf node that is marked as encrypted but NOT already encrypted-string
            if (nextObj.isLeaf && nextObj.encrypted && typeof nextObj.value === 'string') {
                if (!nextObj.value.startsWith('ENC(')) {
                    try {
                        const encData = await osgiService.encrypt(nextObj.value);
                        nextObj.value = encData.encryptedValue || nextObj.value;
                    } catch (e: any) {
                        console.error("Encryption failed for", nextObj.value, e);
                    }
                }
            } else {
                // Not a leaf or not enc leaf, traverse children
                await Promise.all(Object.keys(nextObj).map(async (k) => {
                    if (k === '_order' || typeof nextObj[k] !== 'object' || nextObj[k] === null) return;
                    nextObj[k] = await encryptRecursive(nextObj[k]);
                }));
            }
            return nextObj;
        }
        return obj;
    };

    const handleSave = async (contentToSave?: string) => {
        let finalContent = contentToSave;

        // If contentToSave is provided (e.g. from diff modal), use it directly.
        // Otherwise, calculate it from current state.
        if (finalContent === undefined) {
            if (isRawMode) {
                finalContent = rawContent;
            } else {
                if ((selectedFile?.name.endsWith('.yml') || selectedFile?.name.endsWith('.yml.disabled')) && !isYamlValid) {
                    setModalConfig({
                        type: 'confirm',
                        severity: 'warning',
                        title: t('modal.error.title'),
                        message: t('modal.error.invalidYaml'),
                        cancelLabel: t('modal.ok'),
                        confirmLabel: null
                    });
                    return;
                }

                // Visual Mode Save (CFG or Properties or YML)
                let propsToSave = properties;

                // 1. Check for duplicates (if Array)
                if (Array.isArray(propsToSave)) {
                    const seenKeys = new Set();
                    const duplicateKeys = new Set();
                    propsToSave.forEach(entry => {
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
                        return;
                    }
                }

                // 2. Encrypt Recursive (Decrypted-in-Memory Model)
                // We must encrypt before generating the string content for saving
                propsToSave = await encryptRecursive(JSON.parse(JSON.stringify(properties)));

                // 3. Convert to String Format
                if (Array.isArray(propsToSave)) {
                    // For CFG Array
                    const { toCfgFormat } = await import('../utils/configUtils');
                    finalContent = toCfgFormat(propsToSave);
                } else if (selectedFile?.name.endsWith('.yml') || selectedFile?.name.endsWith('.yml.disabled')) {
                    // For YAML, we don't have a specific tree-to-yaml converter yet that handles our internal structure perfectly 
                    // unless we rely on the rawContent text editor for YAML.
                    // IMPORTANT: The user hasn't explicitly asked for YAML tree editor support fixes, only CFG.
                    // Logic: If isRawMode=false, we might be in Tree View for YAML? 
                    // Actually, if YAML is loaded, we might be only supporting Raw Mode properly or Tree View is read-only?
                    // Assuming we fallback to rawContent for YAML unless implemented.
                    finalContent = rawContent;
                } else {
                    // For standard properties tree
                    const { prepareDataForSave, toCfgFormat } = await import('../utils/configUtils');
                    const prepared = await prepareDataForSave(propsToSave);
                    finalContent = toCfgFormat(prepared);
                }
            }
        }

        if (!selectedFile) return;

        try {
            await osgiService.save({
                action: 'save',
                filename: selectedFile.name,
                rawContent: finalContent
            });
            success(t('notification.saveSuccess'));

            // Update origins
            // Update origins
            if (isRawMode) {
                setOriginalRawContent(finalContent);

                // Fix: Also update originalProperties/properties to reflect the saved state.
                // Otherwise, hasUnsaved remains true because properties != originalProperties (stale).
                // We parse the text we just saved to get the new canonical properties state.
                // We use dynamic import for parser availability
                const { parseCfgContent } = await import('../utils/configUtils');
                // Note: We might want to handle generic properties vs CFG here, but parseCfgContent is robust enough for our needs
                // or simpler: for YML we might skip this update if we don't sync YML tree yet.
                if (selectedFile?.name.endsWith('.cfg') || selectedFile?.name.endsWith('.cfg.disabled')) {
                    const parsed = parseCfgContent(finalContent);
                    // We must also decrypt in memory if we want the "Visual Mode" state to be correct (decrypted values)
                    const decryptRecursiveRaw = async (obj: any) => {
                        if (Array.isArray(obj)) {
                            await Promise.all(obj.map(item => decryptRecursiveRaw(item)));
                        } else if (obj && typeof obj === 'object') {
                            if (obj.isLeaf && obj.encrypted && typeof obj.value === 'string' && obj.value.startsWith('ENC(')) {
                                try {
                                    const decData = await osgiService.decrypt(obj.value);
                                    obj.value = decData.decryptedValue || obj.value;
                                } catch (e: any) {
                                    // ignore
                                }
                            } else {
                                await Promise.all(Object.keys(obj).map(async k => {
                                    if (typeof obj[k] === 'object') await decryptRecursiveRaw(obj[k]);
                                }));
                            }
                        }
                    };
                    await decryptRecursiveRaw(parsed);

                    resetProperties(parsed);
                    setOriginalProperties(JSON.parse(JSON.stringify(parsed)));
                } else {
                    // For non-cfg (e.g. YML), just syncing raw content is often enough if we don't strictly validate properties state in hasUnsaved for YML
                    // But hasUnsaved checks (properties !== originalProperties)
                    // So we should ideally sync them. But lacking a YML parser here, we'll leave it for now or assume YML usage is raw-centric.
                }

            } else {
                // Visual Mode:
                // Reset "Unsaved Changes" reference to the CURRENT CLEARTEXT properties
                setOriginalProperties(JSON.parse(JSON.stringify(properties)));
                // Update originalRawContent to the encrypted content we just saved
                setOriginalRawContent(finalContent || '');

                // Also update rawContent to match the saved encrypted content
                setRawContent(finalContent || '');
            }

        } catch (e: any) {
            toastError(e.message);
        }
    };

    const handleToggleRawMode = async () => {
        // Capture cleanliness state before toggle
        const wasClean = !hasUnsaved;

        if (isRawMode) {
            // Switching TO Visual Mode
            const { parseCfgContent } = await import('../utils/configUtils');
            const parsed = parseCfgContent(rawContent); // This will have ENC(...) values

            // Decrypt-in-Memory: Decrypt all ENC values
            const decryptRecursiveRaw = async (obj: any) => {
                if (Array.isArray(obj)) {
                    await Promise.all(obj.map(item => decryptRecursiveRaw(item)));
                } else if (obj && typeof obj === 'object') {
                    if (obj.isLeaf && obj.encrypted && typeof obj.value === 'string' && obj.value.startsWith('ENC(')) {
                        try {
                            const decData = await osgiService.decrypt(obj.value);
                            obj.value = decData.decryptedValue || obj.value;
                        } catch (e: any) {
                            // ignore
                        }
                    } else {
                        await Promise.all(Object.keys(obj).map(async k => {
                            if (typeof obj[k] === 'object') await decryptRecursiveRaw(obj[k]);
                        }));
                    }
                }
            };
            await decryptRecursiveRaw(parsed);

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
            const propsToEnc = await encryptRecursive(JSON.parse(JSON.stringify(properties)));

            // 2. Convert to String
            let formatted = '';

            if (Array.isArray(propsToEnc)) {
                formatted = toCfgFormat(propsToEnc);
            } else {
                const prepared = await prepareDataForSave(propsToEnc);
                formatted = toCfgFormat(prepared);
            }

            setRawContent(formatted);

            // Rebaseline if we were clean (ignore formatting changes)
            if (wasClean) {
                setOriginalRawContent(formatted);
            }
        }
        setIsRawMode(!isRawMode);
    };

    const handleToggleFile = async (f: OsgiFile) => {
        try {
            await osgiService.toggle(f.name);
            await fetchFiles(); // Wait for files to refresh

            // Calculate new name to preserve selection
            const isDisabled = f.name.endsWith('.disabled');
            const newName = isDisabled ? f.name.replace('.disabled', '') : f.name + '.disabled';

            // If the toggled file was selected, update selection to the new name
            if (selectedFile && selectedFile.name === f.name) {
                setSelectedFile({ ...f, name: newName, enabled: !f.enabled });
            }
            success(t('notification.toggleSuccess', { name: f.name }) || `Toggled ${f.name}`);
        } catch (e: any) {
            toastError(t('modal.error.toggle', { error: e.message }));
        }
    };

    const handleDeleteFile = async (f: OsgiFile) => {
        setModalConfig({
            type: 'confirm',
            title: t('modal.deleteFile.title'),
            message: t('modal.deleteFile.message', { name: f.name }),
            onConfirm: async () => {
                try {
                    await osgiService.delete(f.name);
                    if (selectedFile?.name === f.name) setSelectedFile(null);
                    fetchFiles();
                    success(t('notification.deleteSuccess', { name: f.name }) || `Deleted ${f.name}`);
                } catch (e: any) {
                    toastError(t('modal.error.delete', { error: e.message }));
                }
            }
        });
    };

    const handleCreateFile = async (filename: string) => {
        const validExtensions = ['.cfg', '.yml', '.cfg.disabled', '.yml.disabled'];
        const isValid = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));

        if (!isValid) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.invalidExtension'),
                cancelLabel: t('modal.ok'),
                confirmLabel: null
            });
            return;
        }

        try {
            await osgiService.create(filename);
            await fetchFiles();
            const isEnabled = !filename.endsWith('.disabled');
            setSelectedFile({ name: filename, enabled: isEnabled });
            success(t('notification.createSuccess', { name: filename }) || `Created ${filename}`);
        } catch (e: any) {
            toastError(t('modal.error.create', { error: e.message }));
        }
    };

    const handleUploadFile = async (file: File) => {
        if (!file) return;

        const processUpload = async (fileObj: File, customName?: string) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;
                const filename = customName || fileObj.name;
                const isCfg = filename.toLowerCase().endsWith('.cfg');
                const isYml = filename.toLowerCase().endsWith('.yml');

                if (!isCfg && !isYml) {
                    setModalConfig({
                        type: 'confirm',
                        severity: 'warning',
                        title: t('modal.error.title'),
                        message: t('modal.error.invalidExtensionUpload'),
                        cancelLabel: t('modal.ok'),
                        confirmLabel: null
                    });
                    return;
                }

                try {
                    const payload: any = {
                        action: 'save',
                        filename: filename
                    };

                    if (isYml || isCfg) {
                        payload.rawContent = content;
                    }

                    await osgiService.save(payload);

                    const baseName = filename.replace(/\.disabled$/, '');
                    const existingConflict = files.find(f => f.name !== filename && (f.name === baseName || f.name === baseName + '.disabled'));

                    if (existingConflict) {
                        await osgiService.delete(existingConflict.name);
                    }

                    await fetchFiles();
                    const isEnabled = !filename.endsWith('.disabled');
                    setSelectedFile({ name: filename, enabled: isEnabled });
                    success(t('notification.uploadSuccess', { name: filename }) || `Uploaded ${filename}`);

                } catch (err: any) {
                    toastError(t('modal.error.save', { error: err.message }));
                }
            };
            reader.readAsText(fileObj);
        };

        const targetName = file.name;
        const baseName = targetName.replace(/\.disabled$/, '');
        const existing = files.find(f => f.name === baseName || f.name === baseName + '.disabled');

        if (existing) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.conflict.title'),
                message: t('modal.conflict.message', { name: existing.name }),
                confirmLabel: t('modal.conflict.overwrite'),
                otherLabel: t('modal.conflict.rename'),
                cancelLabel: t('modal.cancel'),
                onConfirm: () => {
                    processUpload(file);
                },
                onOther: () => {
                    setTimeout(() => {
                        setModalConfig({
                            type: 'prompt',
                            title: t('modal.rename.title'),
                            message: t('modal.rename.message'),
                            defaultValue: targetName,
                            onConfirm: (newName) => {
                                if (newName) processUpload(file, newName);
                            }
                        });
                    }, 100);
                }
            });
        } else {
            processUpload(file);
        }
    };

    const handleRawUpdate = (val: string) => {
        setRawContent(val);
    };

    const handleAddItem = (path: (string | number)[]) => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.addItem.title'),
            message: t('modal.addItem.message'),
            onConfirm: (val) => addItem(path, val)
        });
    };

    const handleAddProperty = (path: (string | number)[]) => {
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
    };

    const handleDeleteProperty = (path: (string | number)[]) => {
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
    };

    return {
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
        handleToggleEncryption
    };
};
