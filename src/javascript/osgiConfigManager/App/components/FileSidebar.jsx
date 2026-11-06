import React from 'react';
import {
    Paper,
    Typography,
    Tooltip,
    SearchInput,
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Switch
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { ConfigStateBadge } from './ConfigStateBadge';
import {
    CHROME_TOKENS,
    getFileStatusIndicatorStyle,
    OverflowPreviewText,
    PANEL_STYLE,
    SEARCH_SECTION_STYLE,
    SIDEBAR_PANE_FLEX,
    VISUALLY_HIDDEN_STYLE
} from './AppChrome';

const fileRowId = name => 'file-row-' + encodeURIComponent(name);

export const FileSidebar = ({
    files,
    selectedFile,
    handleFileClick,
    searchTerm,
    setSearchTerm,
    searchInContent,
    setSearchInContent
}) => {
    const { t } = useTranslation('osgi-configurations-manager');

    const getFilenameColor = React.useCallback((filename, isSelected) => {
        if (isSelected) {
            return 'inherit';
        }

        if (filename.endsWith('.yml') || filename.endsWith('.yml.disabled')) {
            return 'var(--color-accent_dark)';
        }

        return CHROME_TOKENS.strongTextColor;
    }, []);
    // Memoize the filtered and sorted list to enable index-based navigation
    const processedFiles = React.useMemo(() => {
        return files
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
            });
    }, [files, searchTerm, searchInContent]);

    // Auto-scroll to selected file
    React.useEffect(() => {
        if (selectedFile) {
            // sanitize name for ID? usually Names are filenames, safe-ish but good to be careful.
            // encodeURIComponent might be safer if filenames have weird chars
            const el = document.getElementById(fileRowId(selectedFile.name));
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedFile]);

    const handleKeyDown = (e) => {
        if (!processedFiles.length) return;

        const currentIndex = selectedFile
            ? processedFiles.findIndex(f => f.name === selectedFile.name)
            : -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = currentIndex < processedFiles.length - 1 ? currentIndex + 1 : 0;
            // The useEffect will handle scrolling after selection update
            handleFileClick(processedFiles[nextIndex]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : processedFiles.length - 1;
            handleFileClick(processedFiles[prevIndex]);
        } else if (e.key === 'Home') {
            e.preventDefault();
            handleFileClick(processedFiles[0]);
        } else if (e.key === 'End') {
            e.preventDefault();
            handleFileClick(processedFiles[processedFiles.length - 1]);
        }
    };

    const isSelectedListed = Boolean(selectedFile) && processedFiles.some(f => f.name === selectedFile.name);

    return (
        <Paper style={{ ...PANEL_STYLE, ...SIDEBAR_PANE_FLEX, height: '100%' }}>
            {/* Search & Filter Section */}
            <div style={SEARCH_SECTION_STYLE}>
                <div data-cy="file-search-input">
                    <SearchInput
                        value={searchTerm}
                        aria-label={t('app.searchLabel')}
                        placeholder={t('app.searchPlaceholder')}
                        onChange={e => setSearchTerm(e.target.value)}
                        onClear={() => setSearchTerm('')}
                    />
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: '2px'
                }}>
                    <Tooltip label={t('app.searchDeepTooltip')}>
                        <div data-cy="deep-search-toggle" style={{ display: 'flex', alignItems: 'center' }}>
                            <Switch
                                data-cy="deep-search-toggle-control"
                                id="osgi-deep-search"
                                checked={searchInContent}
                                onChange={() => setSearchInContent(!searchInContent)}
                            />
                        </div>
                    </Tooltip>
                    <Typography variant="body" component="label" htmlFor="osgi-deep-search">{t('app.searchDeep')}</Typography>
                </div>
            </div>

            {/* File List: one Tab stop (the listbox), the arrow keys move the selection. Moonstone
                gives every row tabIndex 0, which made each file a Tab stop that Enter did not open. */}
            <div
                className="osgi-file-list"
                data-cy="file-list"
                role="listbox"
                aria-label={t('app.fileList')}
                aria-activedescendant={isSelectedListed ? fileRowId(selectedFile.name) : undefined}
                style={{ flex: 1, overflowY: 'auto' }}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                <Table role="presentation" style={{ width: '100%', tableLayout: 'fixed', overflow: 'hidden' }}>
                    <TableBody role="presentation">
                        {processedFiles.map(f => (
                            <TableRow
                                key={f.path}
                                id={fileRowId(f.name)}
                                data-cy={`file-row-${encodeURIComponent(f.name)}`}
                                role="option"
                                aria-selected={selectedFile?.name === f.name}
                                tabIndex={undefined}
                                isHighlighted={selectedFile?.name === f.name}
                                onClick={() => handleFileClick(f)}
                                style={{ cursor: 'pointer' }}
                            >
                                <TableBodyCell
                                    className="osgi-sidebar-status-cell"
                                    width="12px"
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'stretch',
                                            justifyContent: 'flex-start',
                                            width: '100%',
                                            height: '48px'
                                        }}
                                    >
                                        <div data-cy={`sidebar-file-status-${encodeURIComponent(f.name)}`} aria-hidden="true" style={getFileStatusIndicatorStyle(f.enabled)} />
                                    </div>
                                </TableBodyCell>
                                <TableBodyCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minWidth: 0, height: '48px', paddingRight: '4px' }}>
                                        <OverflowPreviewText
                                            text={f.name}
                                            dataCy={`sidebar-file-name-${encodeURIComponent(f.name)}`}
                                            typographyProps={{
                                                variant: 'body',
                                                weight: selectedFile?.name === f.name ? 'bold' : 'default'
                                            }}
                                            wrapperStyle={{flex: 1, display: 'flex', alignItems: 'center'}}
                                            textStyle={{
                                                color: getFilenameColor(f.name, selectedFile?.name === f.name),
                                                textDecoration: f.enabled ? 'none' : 'line-through'
                                            }}
                                        />
                                        {!f.enabled && <span style={VISUALLY_HIDDEN_STYLE}>, {t('app.fileDisabled')}</span>}
                                        <ConfigStateBadge state={f.configState} compact />
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
