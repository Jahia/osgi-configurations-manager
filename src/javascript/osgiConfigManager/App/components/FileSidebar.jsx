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
    Delete,
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
    rawContent,
    searchInContent,
    setSearchInContent
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

    // Helper to get the full file object currently selected (to access 'enabled' state up-to-date)
    const currentFile = selectedFile ? files.find(f => f.name === selectedFile.name) : null;

    return (
        <Paper style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: '10px', height: '100%' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '40px' }}>
                {/* Left: Context Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div title={t('tooltip.toggleFile')}>
                        <Switch
                            checked={currentFile ? currentFile.enabled : false}
                            onChange={() => currentFile && handleToggleFile(currentFile)}
                            disabled={!currentFile}
                        />
                    </div>
                    <Button
                        size="big"
                        color="danger"
                        variant="ghost"
                        icon={<Delete size="big" />}
                        onClick={() => currentFile && handleDeleteFile(currentFile)}
                        disabled={!currentFile}
                        title={t('tooltip.deleteFile')}
                    />
                </div>

                {/* Right: Global Actions */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Button
                        size="big"
                        icon={<CloudUpload size="big" />}
                        color="primary"
                        onClick={handleUploadClick}
                        title={t('tooltip.uploadFile')}
                    />
                    <Button
                        size="big"
                        icon={<CloudDownload size="big" />}
                        color="primary"
                        onClick={handleDownload}
                        disabled={!currentFile}
                        title={t('tooltip.downloadFile')}
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".yml,.cfg"
                        onChange={onFileChange}
                    />
                    <Button
                        size="big"
                        icon={<Add size="big" />}
                        color="accent"
                        onClick={onCreateClick}
                        title={t('tooltip.createFile')}
                    />
                </div>
            </div>

            {/* Search & Filter Section */}
            <div style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <SearchInput
                    value={searchTerm}
                    placeholder={t('app.searchPlaceholder')}
                    onChange={e => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm('')}
                />

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: '2px'
                }} title={t('app.searchDeepTooltip')}>
                    <Switch
                        checked={searchInContent}
                        onChange={() => setSearchInContent(!searchInContent)}
                    />
                    <Typography variant="body">{t('app.searchDeep')}</Typography>
                </div>
            </div>

            {/* File List */}
            <div style={{ flex: 1, overflowY: 'auto' }} onScroll={() => setHoveredFile(null)}>
                <Table style={{ width: '100%', tableLayout: 'fixed', overflow: 'hidden' }}>
                    <TableBody>
                        {files
                            .filter(f => {
                                if (searchInContent) return true;
                                return f.name.toLowerCase().includes(searchTerm.toLowerCase());
                            })
                            .sort((a, b) => {
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
                                    style={{ cursor: 'pointer' }}
                                >
                                    <TableBodyCell>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
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
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflow: 'hidden'
                                                }}
                                                onMouseEnter={(e) => handleMouseEnter(e, f)}
                                                onMouseLeave={() => setHoveredFile(null)}
                                            >
                                                {hoveredFile === f.name && createPortal(
                                                    <div style={{
                                                        position: 'fixed',
                                                        top: hoverPos.top,
                                                        left: hoverPos.left + 20, // Offset slightly
                                                        padding: '4px 8px',
                                                        backgroundColor: '#333',
                                                        color: '#fff',
                                                        borderRadius: '4px',
                                                        zIndex: 1000000,
                                                        whiteSpace: 'nowrap',
                                                        fontSize: '0.875rem',
                                                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                                        pointerEvents: 'none'
                                                    }}>
                                                        {f.name}
                                                    </div>,
                                                    document.body
                                                )}
                                                <Typography variant="body" weight={selectedFile?.name === f.name ? "bold" : "default"} style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: selectedFile?.name === f.name ? 'inherit' : (f.name.endsWith('.yml') ? '#00a0e3' : '#333'),
                                                    textDecoration: f.enabled ? 'none' : 'line-through'
                                                }}>
                                                    {f.name}
                                                </Typography>
                                            </div>
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
