import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { osgiService } from '../api/osgiService';
import { useToast } from './useToast';
import { OsgiFile, ModalConfig } from './osgiTypes';

interface FileActionsDeps {
    files: OsgiFile[];
    selectedFile: OsgiFile | null;
    fetchFiles: (query?: string, deep?: boolean) => Promise<void>;
    fetchFileContent: (filename: string) => Promise<void>;
    selectFile: (file: OsgiFile | null) => void;
    setSelectedFile: React.Dispatch<React.SetStateAction<OsgiFile | null>>;
    setModalConfig: React.Dispatch<React.SetStateAction<ModalConfig | null>>;
}

/**
 * File-level actions (enable/disable, delete, mark-as-default, create, create-from-metatype,
 * upload) extracted from {@code useOsgiConfigs} so the orchestration hook stays a thin composition
 * root. Each handler builds a confirmation/creation modal and talks to {@code osgiService}.
 */
export const useFileActions = ({
    files,
    selectedFile,
    fetchFiles,
    fetchFileContent,
    selectFile,
    setSelectedFile,
    setModalConfig
}: FileActionsDeps) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const { success, error: toastError } = useToast();

    const toggleFileStatus = useCallback(async (f: OsgiFile) => {
        try {
            await osgiService.toggle(f.name);
            await fetchFiles(); // Wait for files to refresh

            // Calculate new name to preserve selection
            const isDisabled = f.name.endsWith('.disabled');
            const newName = isDisabled ? f.name.replace('.disabled', '') : f.name + '.disabled';

            // If the toggled file was selected, update selection to the new name
            if (selectedFile && selectedFile.name === f.name) {
                selectFile({ ...f, name: newName, enabled: !f.enabled });
            }
            success(t('notification.toggleSuccess', { name: f.name }) || `Toggled ${f.name}`);
        } catch (e: any) {
            toastError(t('modal.error.toggle', { error: e.message }));
        }
    }, [fetchFiles, selectFile, selectedFile, success, t, toastError]);

    const handleToggleFile = useCallback(async (f: OsgiFile) => {
        if (f.enabled === false || f.name.endsWith('.disabled')) {
            await toggleFileStatus(f);
            return;
        }

        setModalConfig({
            type: 'confirm',
            severity: 'warning',
            title: t('modal.disableFile.title'),
            message: t('modal.disableFile.message', { name: f.name }),
            confirmLabel: t('modal.disableFile.confirm'),
            cancelLabel: t('modal.disableFile.cancel'),
            onConfirm: async () => {
                await toggleFileStatus(f);
            }
        });
    }, [setModalConfig, t, toggleFileStatus]);

    const handleDeleteFile = useCallback(async (f: OsgiFile) => {
        setModalConfig({
            type: 'confirm',
            severity: 'warning',
            title: t('modal.deleteFile.title'),
            message: t('modal.deleteFile.message', { name: f.name }),
            onConfirm: async () => {
                try {
                    await osgiService.delete(f.name);
                    if (selectedFile?.name === f.name) {
                        selectFile(null);
                    }
                    fetchFiles();
                    success(t('notification.deleteSuccess', { name: f.name }) || `Deleted ${f.name}`);
                } catch (e: any) {
                    toastError(t('modal.error.delete', { error: e.message }));
                }
            }
        });
    }, [fetchFiles, selectFile, selectedFile, setModalConfig, success, t, toastError]);

    const handleMarkAsDefault = useCallback(async (f: OsgiFile) => {
        setModalConfig({
            type: 'confirm',
            severity: 'info',
            title: t('modal.markAsDefault.title'),
            message: t('modal.markAsDefault.message', { name: f.name }),
            confirmLabel: t('modal.markAsDefault.confirm'),
            cancelLabel: t('modal.cancel'),
            onConfirm: async () => {
                try {
                    await osgiService.markAsDefault(f.name);
                    await fetchFiles();
                    setSelectedFile(prev => prev ? {
                        ...prev,
                        configState: 'MODULE_DEFAULT'
                    } : prev);
                    await fetchFileContent(f.name);
                    success(t('notification.markAsDefaultSuccess', { name: f.name }));
                } catch (e: any) {
                    toastError(t('modal.error.markAsDefault', { error: e.message }));
                }
            }
        });
    }, [fetchFileContent, fetchFiles, setModalConfig, setSelectedFile, success, t, toastError]);

    const handleCreateFile = useCallback(async (filename: string) => {
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
            selectFile({ name: filename, enabled: isEnabled, configState: 'USER' });
            success(t('notification.createSuccess', { name: filename }) || `Created ${filename}`);
        } catch (e: any) {
            toastError(t('modal.error.create', { error: e.message }));
        }
    }, [fetchFiles, selectFile, setModalConfig, success, t, toastError]);

    const handleCreateFileFromMetatype = useCallback(async (pid: string, instanceIdentifier?: string) => {
        try {
            const response = await osgiService.createFromMetatype(pid, instanceIdentifier);
            const filename = response.filename || (instanceIdentifier ? `${pid}-${instanceIdentifier}.cfg` : `${pid}.cfg`);
            await fetchFiles();
            selectFile({ name: filename, enabled: true, configState: 'USER' });
            success(t('notification.createSuccess', { name: filename }) || `Created ${filename}`);
        } catch (e: any) {
            toastError(t('modal.error.create', { error: e.message }));
        }
    }, [fetchFiles, selectFile, success, t, toastError]);

    const handleOpenCreateDialog = useCallback(async () => {
        try {
            const data = await osgiService.getAvailableMetatypes();
            const availableMetatypes = data.metatypes || [];

            setModalConfig({
                type: 'createConfig',
                title: t('modal.create.title'),
                message: t('modal.create.message'),
                confirmLabel: t('modal.create.confirm'),
                cancelLabel: t('modal.cancel'),
                availableMetatypes,
                onConfirm: async (payload?: { mode?: 'manual' | 'metatype' | 'factory'; filename?: string; pid?: string; instanceIdentifier?: string }) => {
                    if (!payload) {
                        return;
                    }

                    if (payload.mode === 'metatype' && payload.pid) {
                        await handleCreateFileFromMetatype(payload.pid);
                        return;
                    }

                    if (payload.mode === 'factory' && payload.pid && payload.instanceIdentifier) {
                        await handleCreateFileFromMetatype(payload.pid, payload.instanceIdentifier);
                        return;
                    }

                    if (payload.mode === 'manual' && payload.filename) {
                        await handleCreateFile(payload.filename);
                    }
                }
            });
        } catch (e: any) {
            toastError(t('modal.error.create', { error: e.message }));
            setModalConfig({
                type: 'prompt',
                title: t('modal.create.title'),
                message: t('modal.create.manualFallbackMessage'),
                onConfirm: (name) => {
                    if (name) handleCreateFile(name);
                }
            });
        }
    }, [handleCreateFile, handleCreateFileFromMetatype, setModalConfig, t, toastError]);

    const handleUploadFile = useCallback(async (file: File) => {
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
                    selectFile({ name: filename, enabled: isEnabled, configState: 'USER' });
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
    }, [fetchFiles, files, selectFile, setModalConfig, success, t, toastError]);

    return {
        toggleFileStatus,
        handleToggleFile,
        handleDeleteFile,
        handleMarkAsDefault,
        handleCreateFile,
        handleCreateFileFromMetatype,
        handleOpenCreateDialog,
        handleUploadFile
    };
};
