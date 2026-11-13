import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { osgiService } from '../api/osgiService';
import { useToast } from './useToast';
import { OsgiFile, ModalConfig, ConfirmResult } from './osgiTypes';
import { filesOfSameConfiguration, isDisabledFile } from '../utils/configIdentity';

interface FileActionsDeps {
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
            const isDisabled = isDisabledFile(f.name);
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
        if (f.enabled === false || isDisabledFile(f.name)) {
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
            // Named after the action: the danger button read "OK".
            confirmLabel: t('modal.deleteFile.confirm'),
            onConfirm: async () => {
                try {
                    await osgiService.delete(f.name);
                    if (selectedFile?.name === f.name) {
                        selectFile(null);
                    }
                    await fetchFiles();
                    success(t('notification.deleteSuccess', { name: f.name }) || `Deleted ${f.name}`);
                    // The dialog gave the focus back to the Delete button, which is gone with the
                    // file: the focus fell to <body>. Put it on the file list (WCAG 2.4.3).
                    window.requestAnimationFrame(() => {
                        document.querySelector<HTMLElement>('[data-cy="file-list"]')?.focus();
                    });
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

    // The create dialogs stay open until these succeed and show what they return next to the
    // field (ModalConfig.awaitConfirm), so they report errors rather than toast them.
    const handleCreateFile = useCallback(async (filename: string): Promise<ConfirmResult> => {
        const validExtensions = ['.cfg', '.yml', '.cfg.disabled', '.yml.disabled'];
        const isValid = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));

        if (!isValid) {
            return { ok: false, field: 'filename', message: t('modal.error.invalidExtension') };
        }

        try {
            await osgiService.create(filename);
            await fetchFiles();
            const isEnabled = !isDisabledFile(filename);
            selectFile({ name: filename, enabled: isEnabled, configState: 'USER' });
            success(t('notification.createSuccess', { name: filename }) || `Created ${filename}`);
            return { ok: true };
        } catch (e: any) {
            return { ok: false, field: 'filename', message: t('modal.error.create', { error: e.message }) };
        }
    }, [fetchFiles, selectFile, success, t]);

    const handleCreateFileFromMetatype = useCallback(async (pid: string, instanceIdentifier?: string): Promise<ConfirmResult> => {
        try {
            const response = await osgiService.createFromMetatype(pid, instanceIdentifier);
            const filename = response.filename || (instanceIdentifier ? `${pid}-${instanceIdentifier}.cfg` : `${pid}.cfg`);
            await fetchFiles();
            selectFile({ name: filename, enabled: true, configState: 'USER' });
            success(t('notification.createSuccess', { name: filename }) || `Created ${filename}`);
            return { ok: true };
        } catch (e: any) {
            const message = t('modal.error.create', { error: e.message });
            return instanceIdentifier ? { ok: false, field: 'identifier', message } : { ok: false, message };
        }
    }, [fetchFiles, selectFile, success, t]);

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
                awaitConfirm: true,
                onUnshownError: toastError,
                onConfirm: async (payload?: { mode?: 'manual' | 'metatype' | 'factory'; filename?: string; pid?: string; instanceIdentifier?: string }): Promise<ConfirmResult> => {
                    if (payload?.mode === 'metatype' && payload.pid) {
                        return handleCreateFileFromMetatype(payload.pid);
                    }

                    if (payload?.mode === 'factory' && payload.pid && payload.instanceIdentifier) {
                        return handleCreateFileFromMetatype(payload.pid, payload.instanceIdentifier);
                    }

                    if (payload?.mode === 'manual' && payload.filename) {
                        return handleCreateFile(payload.filename);
                    }

                    return { ok: true };
                }
            });
        } catch (e: any) {
            toastError(t('modal.error.create', { error: e.message }));
            setModalConfig({
                type: 'prompt',
                title: t('modal.create.title'),
                message: t('modal.create.manualFallbackMessage'),
                awaitConfirm: true,
                onUnshownError: toastError,
                onConfirm: async (name?: string): Promise<ConfirmResult> => (
                    name?.trim() ? handleCreateFile(name.trim()) : { ok: false, field: 'filename', message: t('modal.error.invalidExtension') }
                )
            });
        }
    }, [handleCreateFile, handleCreateFileFromMetatype, setModalConfig, t, toastError]);

    const handleUploadFile = useCallback(async (file: File) => {
        if (!file) return;

        // conflicts: the files the user agreed to replace. The save overwrites the one with the same
        // name; the others (another extension, .disabled, another case) would configure the same PID
        // alongside it, so they are deleted.
        const processUpload = (filename: string, conflicts: OsgiFile[]) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;

                try {
                    await osgiService.save({ action: 'save', filename, rawContent: content });

                    // Lower-cased: on a case-insensitive disk, Foo.cfg is the file just saved.
                    for (const conflict of conflicts) {
                        if (conflict.name.toLowerCase() !== filename.toLowerCase()) {
                            await osgiService.delete(conflict.name);
                        }
                    }

                    await fetchFiles();
                    const isEnabled = !isDisabledFile(filename);
                    selectFile({ name: filename, enabled: isEnabled, configState: 'USER' });
                    success(t('notification.uploadSuccess', { name: filename }) || `Uploaded ${filename}`);

                } catch (err: any) {
                    toastError(t('modal.error.save', { error: err.message }));
                }
            };
            reader.readAsText(file);
        };

        // Both the file's own name and a name typed after Rename come here. The overwrite check asks
        // the server for the full list: the sidebar's holds only the matches of a content search, so
        // an existing configuration was overwritten without a question (WCAG 3.3.4).
        const startUpload = async (filename: string) => {
            const lowerName = filename.toLowerCase();
            if (!lowerName.endsWith('.cfg') && !lowerName.endsWith('.yml')) {
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

            let conflicts: OsgiFile[];
            try {
                const { files: allFiles = [] } = await osgiService.getAll();
                conflicts = filesOfSameConfiguration(allFiles, filename);
            } catch (err: any) {
                // Fail closed: without the list, an overwrite could not be confirmed.
                toastError(t('modal.error.save', { error: err.message }));
                return;
            }

            if (conflicts.length === 0) {
                processUpload(filename, []);
                return;
            }

            setModalConfig({
                type: 'confirm',
                severity: 'warning',
                title: t('modal.conflict.title'),
                message: t('modal.conflict.message', { name: filename, files: conflicts.map(conflict => conflict.name).join(', ') }),
                confirmLabel: t('modal.conflict.overwrite'),
                otherLabel: t('modal.conflict.rename'),
                cancelLabel: t('modal.cancel'),
                onConfirm: () => {
                    processUpload(filename, conflicts);
                },
                onOther: () => {
                    setTimeout(() => {
                        setModalConfig({
                            type: 'prompt',
                            title: t('modal.rename.title'),
                            message: t('modal.rename.message'),
                            defaultValue: filename,
                            onConfirm: (newName) => {
                                if (newName?.trim()) void startUpload(newName.trim());
                            }
                        });
                    }, 100);
                }
            });
        };

        await startUpload(file.name);
    }, [fetchFiles, selectFile, setModalConfig, success, t, toastError]);

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
