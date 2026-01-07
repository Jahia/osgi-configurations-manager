import React from 'react';
import {
    Paper,
    Button,
    Typography,
    SearchInput,
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Close,
    Add,
    Switch,
    CloudDownload,
    CloudUpload
} from '@jahia/moonstone';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export const FileSidebar = ({
    files,
    selectedFile,
    handleFileClick,
    handleToggleFile,
    handleDeleteFile,
    handleCreateFile,
    searchTerm,
    setSearchTerm,
    setModalConfig,
    handleUploadFile,
    hasUnsaved,
    rawContent // Need rawContent for download if selectedFile is loaded
}) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [hoveredFile, setHoveredFile] = React.useState(null);
    const [hoverPos, setHoverPos] = React.useState({ top: 0, left: 0 });
    const fileInputRef = React.useRef(null);

    const handleDownload = () => {
        if (!selectedFile) return;

        // For download, we prefer rawContent from hook if available (for YML), 
        // OR we might need to construct it for CFG if we edited it? 
        // Actually, for download "Raw Data" imply what is currently Saved on server or what is in Editor?
        // User said "download file (raw data) selected". Usually implies the file content.
        // If we have unsaved changes, should we download unsaved? probably better for backup.
        // But for CFG, 'rawContent' in hook might be empty or stale if we edited using CfgEditor (which updates 'properties').
        // We only have 'prepareDataForSave' which returns properties. We don't have a 'propertiesToCfgString' generator.
        // HOWEVER, the backend 'readFile' returns 'rawContent' for BOTH cfg and yml now (I saw it in Java: lines 95-97).
        // So 'rawContent' in hook SHOULD correspond to the loaded file content.
        // BUT if user modified Cfg properties, 'rawContent' is NOT updated in real-time in CfgEditor (it updates 'properties').
        // So downloading 'rawContent' will download the version ON DISK (last saved), not current edits. This is acceptable for "Download File".
        // If we want "Export Current State", that's harder for CFG.
        // Let's implement "Download Saved File" using rawContent.

        if (!rawContent) return;

        const element = document.createElement("a");
        const file = new Blob([rawContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = selectedFile.name;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const onFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleUploadFile(file);
        }
        e.target.value = null; // Reset
    };


    const onCreateClick = () => {
        setModalConfig({
            type: 'prompt',
            title: t('modal.create.title'),
            message: t('modal.create.message'),
            onConfirm: (name) => {
                if (name) handleCreateFile(name);
            }
        });
    };

    const handleMouseEnter = (e, f) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverPos({ top: rect.top, left: rect.left, height: rect.height });
        setHoveredFile(f.name);
    };

    return (
        <Paper style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: '10px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <SearchInput
                    value={searchTerm}
                    placeholder={t('app.searchPlaceholder')}
                    onChange={e => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm('')}
                />
                <Button
                    icon={<CloudDownload />}
                    variant="ghost"
                    onClick={handleDownload}
                    disabled={!selectedFile}
                    title={t('tooltip.downloadFile')}
                />
                <Button
                    icon={<CloudUpload />}
                    variant="ghost"
                    onClick={handleUploadClick}
                    title={t('tooltip.uploadFile')}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".yml,.cfg"
                    onChange={onFileChange}
                />
                <Button icon={<Add />} color="accent" onClick={onCreateClick} title={t('tooltip.createFile')} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }} onScroll={() => setHoveredFile(null)}>
                <Table style={{ width: '100%', tableLayout: 'auto', overflow: 'visible' }}>
                    <TableBody style={{ overflow: 'visible' }}>
                        {files
                            .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .sort((a, b) => {
                                // Extract type (ignoring .disabled)
                                const getExt = (name) => {
                                    const clean = name.replace('.disabled', '');
                                    return clean.substring(clean.lastIndexOf('.') + 1);
                                };
                                const extA = getExt(a.name);
                                const extB = getExt(b.name);

                                if (extA !== extB) return extA.localeCompare(extB);
                                return a.name.localeCompare(b.name);
                            })
                            .map(f => (
                                <TableRow
                                    key={f.path}
                                    isHighlighted={selectedFile?.name === f.name}
                                    onClick={() => handleFileClick(f)}
                                    style={{ overflow: 'visible', position: 'relative' }}
                                >
                                    <TableBodyCell style={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'visible', height: '100%' }}>
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: f.enabled ? '#4caf50' : '#bdbdbd',
                                                flexShrink: 0
                                            }} />
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    overflow: 'visible',
                                                    flex: 1,
                                                    minWidth: 0,
                                                    cursor: 'pointer'
                                                }}
                                                onMouseEnter={(e) => handleMouseEnter(e, f)}
                                                onMouseLeave={() => setHoveredFile(null)}
                                            >
                                                {hoveredFile === f.name && createPortal(
                                                    <div style={{
                                                        position: 'fixed',
                                                        top: hoverPos.top,
                                                        left: hoverPos.left - 4,
                                                        height: hoverPos.height,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        backgroundColor: selectedFile?.name === f.name ? '#00a0e3' : '#fff',
                                                        color: selectedFile?.name === f.name ? '#fff' : (f.name.endsWith('.yml') ? '#00a0e3' : (f.enabled ? '#333' : '#666')),
                                                        padding: '0 8px',
                                                        zIndex: 1000000,
                                                        whiteSpace: 'nowrap',
                                                        pointerEvents: 'none',
                                                        width: 'max-content',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.875rem',
                                                        boxShadow: '4px 0 8px rgba(0,0,0,0.1)'
                                                    }}>
                                                        {f.name}
                                                    </div>,
                                                    document.body
                                                )}
                                                <Typography variant="caption" weight="bold" style={{
                                                    wordBreak: 'break-all',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: selectedFile?.name === f.name
                                                        ? 'inherit'
                                                        : (f.name.endsWith('.yml') ? '#00a0e3' : (f.enabled ? '#333' : '#666')),
                                                    textDecoration: f.enabled ? 'none' : 'line-through'
                                                }}>
                                                    {f.name}
                                                </Typography>
                                            </div>
                                        </div>
                                    </TableBodyCell>
                                    <TableBodyCell width="70px" style={{ overflow: 'visible' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <div title={t('tooltip.toggleFile')} onClick={(e) => e.stopPropagation()}>
                                                <Switch
                                                    checked={f.enabled}
                                                    onChange={() => handleToggleFile(f)}
                                                />
                                            </div>
                                            <Button
                                                size="small"
                                                color="danger"
                                                variant="ghost"
                                                icon={<Close />}
                                                style={{ minWidth: '24px', padding: '0', background: 'transparent' }}
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFile(f); }}
                                                title={t('tooltip.deleteFile')}
                                            />
                                        </div>
                                    </TableBodyCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>
        </Paper>
    );
};
