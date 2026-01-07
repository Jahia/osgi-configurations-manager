import { useState, useEffect, useCallback } from 'react';
import { parseData, prepareDataForSave, updateStateDeep } from '../utils/configUtils';
import { useTranslation } from 'react-i18next';

const apiUrl = window.contextJsParameters.contextPath + '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';

export const useOsgiConfigs = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [properties, setProperties] = useState({});
    const [originalProperties, setOriginalProperties] = useState({});
    const [rawContent, setRawContent] = useState('');
    const [originalRawContent, setOriginalRawContent] = useState('');
    const [error, setError] = useState(null);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [collapsedPaths, setCollapsedPaths] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [modalConfig, setModalConfig] = useState(null); // { type, title, message, defaultValue, onConfirm }
    const [isYamlValid, setIsYamlValid] = useState(true);

    const hasUnsaved = JSON.stringify(properties) !== JSON.stringify(originalProperties) || rawContent !== originalRawContent;

    const fetchFiles = useCallback(async () => {
        setLoadingFiles(true);
        try {
            const res = await fetch(apiUrl);
            const data = await res.json();
            if (data.files) {
                setFiles(data.files);
            }
        } catch (e) {
            setError(e.message);
        }
        setLoadingFiles(false);
    }, []);

    const fetchFileContent = useCallback(async (filename) => {
        setLoadingFile(true);
        try {
            const res = await fetch(`${apiUrl}?filename=${encodeURIComponent(filename)}`);
            const data = await res.json();
            if (data.data && data.data.properties) {
                const parsed = parseData(data.data.properties);

                // Helper to find and decrypt all ENC values
                const decryptRecursive = async (obj) => {
                    if (Array.isArray(obj)) {
                        await Promise.all(obj.map(item => decryptRecursive(item)));
                    } else if (obj && typeof obj === 'object') {
                        if (obj.isLeaf && obj.encrypted) {
                            try {
                                const decRes = await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'decrypt', value: obj.value })
                                });
                                const decData = await decRes.json();
                                obj.value = decData.decryptedValue;
                            } catch (e) {
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

                await decryptRecursive(parsed);
                setProperties(parsed);
                setOriginalProperties(JSON.parse(JSON.stringify(parsed)));
                setRawContent(data.data.rawContent || '');
                setOriginalRawContent(data.data.rawContent || '');
                setCollapsedPaths(new Set());
            } else {
                setProperties({});
                setOriginalProperties({});
                setRawContent('');
                setOriginalRawContent('');
            }
        } catch (e) {
            setError(e.message);
        }
        setLoadingFile(false);
    }, [apiUrl]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    useEffect(() => {
        if (selectedFile) {
            fetchFileContent(selectedFile.name);
        }
    }, [selectedFile, fetchFileContent]);

    const handleSave = async () => {
        if (!selectedFile) return;

        if ((selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) && !isYamlValid) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.invalidYaml'), // We'll need to add this key to locales
                cancelLabel: t('modal.ok'),
                confirmLabel: null // Hide confirm button or make it single action
            });
            return;
        }

        try {
            const payload = {
                action: 'save',
                filename: selectedFile.name
            };

            if (selectedFile.name.endsWith('.yml') || selectedFile.name.endsWith('.yml.disabled')) {
                payload.rawContent = rawContent;
            } else {
                payload.properties = await prepareDataForSave(properties, apiUrl);
            }

            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setOriginalProperties(properties);
            setOriginalRawContent(rawContent);
        } catch (e) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.save', { error: e.message })
            });
        }
    };

    const handleToggleFile = async (f) => {
        try {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', filename: f.name })
            });
            await fetchFiles(); // Wait for files to refresh

            // Calculate new name to preserve selection
            const isDisabled = f.name.endsWith('.disabled');
            const newName = isDisabled ? f.name.replace('.disabled', '') : f.name + '.disabled';

            // If the toggled file was selected, update selection to the new name
            if (selectedFile && selectedFile.name === f.name) {
                setSelectedFile({ ...f, name: newName, enabled: !f.enabled });
            }
        } catch (e) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.toggle', { error: e.message })
            });
        }
    };

    const handleDeleteFile = async (f) => {
        setModalConfig({
            type: 'confirm',
            title: t('modal.deleteFile.title'),
            message: t('modal.deleteFile.message', { name: f.name }),
            onConfirm: async () => {
                try {
                    await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', filename: f.name })
                    });
                    if (selectedFile?.name === f.name) setSelectedFile(null);
                    fetchFiles();
                } catch (e) {
                    setError(t('modal.error.delete', { error: e.message }));
                }
            }
        });
    };

    const handleCreateFile = async (filename) => {
        // Validation
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
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', filename })
            });
            await fetchFiles(); // Refresh list to get the new file

            // Auto-select the newly created file
            // Assuming default enabled properties, or we could find it in the refreshed list if we returned it, 
            // but setting it manually matches how we did toggle.
            // Note: Use 'enabled: true' as default for new files usually? Or check extension.
            // Safe bet: find it in the "files" state? 
            // Actually, "files" state won't be updated in this render cycle if we just called fetchFiles.
            // But we can just set the object. 
            // Better: just set the object. 'fetchFileContent' in the useEffect will trigger load.
            const isEnabled = !filename.endsWith('.disabled');
            setSelectedFile({ name: filename, enabled: isEnabled });

        } catch (e) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.error.title'),
                message: t('modal.error.create', { error: e.message })
            });
        }
    };

    const handleUploadFile = async (file) => {
        if (!file) return;

        const processUpload = async (fileObj, customName) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
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
                    const payload = {
                        action: 'save',
                        filename: filename
                    };

                    if (isYml) {
                        payload.rawContent = content;
                    } else if (isCfg) {
                        // Parse content
                        const { parseCfgContent } = await import('../utils/configUtils');
                        payload.properties = parseCfgContent(content);
                    }

                    await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    // If we are "overwriting" a file that had a different name (e.g. .disabled variant), 
                    // we should probably delete the old one to avoid duplicates.
                    // Check if there was an existing conflict with a different name
                    const baseName = filename.replace(/\.disabled$/, '');
                    const existingConflict = files.find(f => f.name !== filename && (f.name === baseName || f.name === baseName + '.disabled'));

                    if (existingConflict) {
                        // Delete the conflicting variant to avoid duplicates (e.g. having both foo.cfg and foo.cfg.disabled)
                        await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'delete', filename: existingConflict.name })
                        });
                    }

                    await fetchFiles(); // Refresh list

                    // Auto-select uploaded file
                    const isEnabled = !filename.endsWith('.disabled');
                    setSelectedFile({ name: filename, enabled: isEnabled });

                } catch (err) {
                    setModalConfig({
                        type: 'confirm',
                        severity: 'warning',
                        title: t('modal.error.title'),
                        message: t('modal.error.save', { error: err.message })
                    });
                }
            };
            reader.readAsText(fileObj);
        };

        const targetName = file.name;
        // Check for ANY existing file with same base name (enabled or disabled)
        const baseName = targetName.replace(/\.disabled$/, '');
        const existing = files.find(f => f.name === baseName || f.name === baseName + '.disabled');

        if (existing) {
            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.conflict.title'),
                message: t('modal.conflict.message', { name: existing.name }), // Show the ACTUAL existing name
                confirmLabel: t('modal.conflict.overwrite'),
                otherLabel: t('modal.conflict.rename'),
                cancelLabel: t('modal.cancel'),
                onConfirm: () => {
                    processUpload(file);
                },
                onOther: () => {
                    // Trigger rename prompt
                    setTimeout(() => { // Timeout to allow previous modal to close
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


    const handlePropUpdate = (path, field, val) => {
        setProperties(prev => updateStateDeep(prev, 0, path, field, val));
    };

    const handleRawUpdate = (val) => {
        setRawContent(val);
    };

    const handleAddProperty = (path) => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.addProp.title'),
            message: t('modal.addProp.message'),
            onConfirm: (key) => {
                if (!key) return;

                // Check if property already exists
                let target = properties;
                for (const part of path) {
                    target = target?.[part];
                }

                if (target && Object.prototype.hasOwnProperty.call(target, key)) {
                    setTimeout(() => {
                        setModalConfig({
                            type: 'confirm',
                            severity: 'warning',
                            title: t('modal.error.title'),
                            message: t('modal.error.propertyExists', { name: key }),
                            cancelLabel: t('modal.ok'),
                            confirmLabel: null
                        });
                    }, 100);
                    return;
                }

                setProperties(prev => updateStateDeep(prev, 0, [...path, key], 'value', '', true));
            }
        });
    };

    const handleAddItem = (path) => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.addItem.title'),
            message: t('modal.addItem.message'),
            onConfirm: (val) => {
                setProperties(prev => {
                    let curr = prev;
                    for (let i = 0; i < path.length; i++) {
                        curr = curr[path[i]];
                    }
                    const nextIdx = Array.isArray(curr) ? curr.length : 0;
                    return updateStateDeep(prev, 0, [...path, nextIdx], 'value', val || '', true);
                });
            }
        });
    };

    const handleDeleteProperty = (path) => {
        const key = path[path.length - 1];
        // For array (CFG), using the index as key to find the item
        // But for display message, we might want the real key if it's a property
        let displayName = key;

        // Try to resolve display name if it's an array index
        if (Array.isArray(properties) && typeof key === 'number') {
            const items = properties;
            // Check if there is a KEY and it has a VALUE
            if (items[key] && items[key].key && items[key].key.value) {
                displayName = items[key].key.value;
            } else if (items[key] && items[key].type) {
                // If no key value, check type
                const typeVal = items[key].type.value || items[key].type; // Handle both object and string potential
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
            onConfirm: () => {
                setProperties(prev => {
                    if (Array.isArray(prev)) {
                        // Handle Array Deletion (for .cfg)
                        const newArr = [...prev];
                        if (typeof key === 'number') {
                            newArr.splice(key, 1);
                        }
                        return newArr;
                    }

                    const next = { ...prev };
                    let curr = next;
                    for (let i = 0; i < path.length - 1; i++) {
                        curr = curr[path[i]];
                    }
                    const lastKey = path[path.length - 1];
                    delete curr[lastKey];
                    if (curr._order) {
                        curr._order = curr._order.filter(k => k !== lastKey);
                    }
                    return next;
                });
            }
        });
    };

    const handleAddCfgEntry = (entry, index) => {
        setProperties(prev => {
            if (Array.isArray(prev)) {
                const newEntry = {};
                Object.keys(entry).forEach(k => {
                    newEntry[k] = { value: entry[k], isLeaf: true };
                });

                const newArr = [...prev];
                if (typeof index === 'number' && index >= 0 && index <= newArr.length) {
                    newArr.splice(index, 0, newEntry);
                } else {
                    newArr.push(newEntry);
                }
                return newArr;
            }
            return prev;
        });
    };

    const handleReorder = (fromIndex, toIndex) => {
        setProperties(prev => {
            if (Array.isArray(prev)) {
                const newArr = [...prev];
                const [movedItem] = newArr.splice(fromIndex, 1);
                newArr.splice(toIndex, 0, movedItem);
                return newArr;
            }
            return prev;
        });
    };

    const toggleCollapse = (keyString) => {
        setCollapsedPaths(prev => {
            const next = new Set(prev);
            if (next.has(keyString)) next.delete(keyString);
            else next.add(keyString);
            return next;
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
        apiUrl,
        isYamlValid,
        setIsYamlValid
    };
};
