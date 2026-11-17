import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OsgiArchiveImportResult, OsgiArchivePreview, osgiService } from '../api/osgiService';
import { useToast } from './useToast';
import { downloadBase64, isExportable, readFileAsBase64 } from '../utils/archiveFile';
import { errorText } from '../utils/errorText';

export interface ArchiveToImport {
    fileName: string;
    base64: string;
}

export interface ExportableFile {
    name: string;
    enabled: boolean;
}

/**
 * The export archive's actions: open the export dialog on the full list of files, seal and
 * download, and the three steps of an import. The dialogs show the errors of a step themselves;
 * the outcome of the whole is a toast, as for the other file actions.
 */
export const useArchiveActions = ({ onImported }: { onImported: (result: OsgiArchiveImportResult) => Promise<void> | void }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const { success, error: toastError, warning } = useToast();
    const [exportFiles, setExportFiles] = useState<ExportableFile[] | null>(null);
    const [archiveToImport, setArchiveToImport] = useState<ArchiveToImport | null>(null);

    // The full list from the server: the sidebar's holds only the matches of a content search.
    const openExport = useCallback(async () => {
        try {
            const { files = [] } = await osgiService.getAll();
            setExportFiles(files
                .filter(file => isExportable(file.name))
                .map(file => ({ name: file.name, enabled: file.enabled !== false })));
        } catch (e) {
            toastError(t('archive.export.error', { error: errorText(e) }));
        }
    }, [t, toastError]);

    const closeExport = useCallback(() => setExportFiles(null), []);

    const exportArchive = useCallback(async (names: string[], password: string) => {
        const result = await osgiService.exportArchive(names, password);
        downloadBase64(result.archive, result.fileName);
        setExportFiles(null);
        success(t('archive.export.success', { count: result.files, fileName: result.fileName }));
        result.warnings.forEach(item => {
            warning(t('archive.export.undecryptable', { name: item.name, count: item.undecryptable }));
        });
    }, [success, t, warning]);

    const openArchive = useCallback(async (file: File) => {
        try {
            setArchiveToImport({ fileName: file.name, base64: await readFileAsBase64(file) });
        } catch (e) {
            toastError(t('archive.import.error', { error: errorText(e) }));
        }
    }, [t, toastError]);

    const closeImport = useCallback(() => setArchiveToImport(null), []);

    const previewImport = useCallback((base64: string, password: string): Promise<OsgiArchivePreview> => (
        osgiService.previewArchiveImport(base64, password)
    ), []);

    const importArchive = useCallback(async (base64: string, password: string, names: string[]) => {
        const result = await osgiService.importArchive(base64, password, names);
        await onImported(result);
        if (result.imported.length > 0) {
            success(t('archive.import.success', { count: result.imported.length }));
        }
        return result;
    }, [onImported, success, t]);

    return {
        exportFiles,
        openExport,
        closeExport,
        exportArchive,
        archiveToImport,
        openArchive,
        closeImport,
        previewImport,
        importArchive
    };
};
