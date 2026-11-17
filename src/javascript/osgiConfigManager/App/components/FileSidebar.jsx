import React from 'react';
import {
    Paper,
    Typography,
    SearchInput,
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Switch
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { WithTooltip } from './WithTooltip';
import { configFileKind } from '../utils/configIdentity';
import { ConfigStateBadge } from './ConfigStateBadge';
import {
    CHROME_TOKENS,
    getFileStatusIndicatorStyle,
    InlineLoader,
    OverflowPreviewText,
    PANEL_STYLE,
    scrollBehavior,
    SEARCH_SECTION_STYLE,
    SIDEBAR_PANE_FLEX,
    VISUALLY_HIDDEN_STYLE
} from './AppChrome';

// The count is announced once the filter has settled; a deep search waits for its results, which
// the hook fetches 500 ms after the last change.
const COUNT_ANNOUNCE_DELAY_MS = 400;
const DEEP_COUNT_ANNOUNCE_DELAY_MS = 700;
const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

export const FileSidebar = ({
    files,
    selectedFile,
    handleFileClick,
    searchTerm,
    setSearchTerm,
    searchInContent,
    setSearchInContent,
    loadingFiles = false,
    hasUnsaved = false
}) => {
    const { t } = useTranslation('osgi-configurations-manager');
    // Ids of this instance: a bare 'file-row-' prefix could meet another id of the admin page.
    const instanceId = React.useId();
    const headingId = `${instanceId}-heading`;
    const hintId = `${instanceId}-hint`;
    const optionId = React.useCallback(name => `${instanceId}-option-${encodeURIComponent(name)}`, [instanceId]);

    const getFilenameColor = React.useCallback((filename, isSelected) => {
        if (isSelected) {
            return 'inherit';
        }

        if (configFileKind(filename) === 'yml') {
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

    // The arrow keys open the file they reach, to page quickly through the configurations. With
    // unsaved changes they only move an active option, which Enter or Space opens: each press asked
    // to discard the changes (WCAG 3.2.2). aria-selected stays on the open file. The active option is
    // kept by name and resolved at render, so that it never points at a row the filter, a rename or a
    // delete removed: the active file if listed, else the open one, else the first.
    const [activeName, setActiveName] = React.useState(selectedFile?.name ?? null);
    React.useEffect(() => {
        if (selectedFile?.name) {
            setActiveName(selectedFile.name);
        }
    }, [selectedFile?.name]);
    // Saved or cancelled, the keys go on from the open file, not from where the ring was left.
    React.useEffect(() => {
        if (!hasUnsaved && selectedFile?.name) {
            setActiveName(selectedFile.name);
        }
    }, [hasUnsaved, selectedFile?.name]);
    const activeFile = processedFiles.find(f => f.name === activeName)
        || (selectedFile && processedFiles.find(f => f.name === selectedFile.name))
        || processedFiles[0]
        || null;

    // The active row's ring is drawn while the list is used from the keyboard. Kept in state rather
    // than left to :focus-visible, which a browser may not turn on for keys after a click on a row.
    const [keyboardMode, setKeyboardMode] = React.useState(false);

    // Auto-scroll to selected file
    React.useEffect(() => {
        if (selectedFile) {
            const el = document.getElementById(optionId(selectedFile.name));
            if (el) {
                el.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior() });
            }
        }
    }, [optionId, selectedFile]);

    // The active row, into view as the keys move it: at once, as the row's name now wraps there.
    React.useEffect(() => {
        if (keyboardMode && activeFile) {
            document.getElementById(optionId(activeFile.name))?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
        }
    }, [activeFile, keyboardMode, optionId]);

    const handleKeyDown = (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || !processedFiles.length) {
            return;
        }

        // Nothing open yet, the ring is on the first file: ArrowDown goes on from it, as it shows.
        const currentIndex = activeFile ? processedFiles.indexOf(activeFile) : -1;
        if (NAVIGATION_KEYS.includes(e.key)) {
            e.preventDefault();
            let nextIndex;
            if (e.key === 'ArrowDown') {
                nextIndex = Math.min(currentIndex + 1, processedFiles.length - 1);
            } else if (e.key === 'ArrowUp') {
                nextIndex = Math.max(currentIndex - 1, 0);
            } else if (e.key === 'Home') {
                nextIndex = 0;
            } else {
                nextIndex = processedFiles.length - 1;
            }
            const nextFile = processedFiles[nextIndex];
            setActiveName(nextFile.name);
            setKeyboardMode(true);
            if (!hasUnsaved && nextFile.name !== selectedFile?.name) {
                handleFileClick(nextFile);
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            // Space would scroll the list. A held key repeats: the unsaved-changes dialog, closed by
            // the first press, would open again.
            e.preventDefault();
            setKeyboardMode(true);
            if (!e.repeat && activeFile) {
                handleFileClick(activeFile);
            }
        }
    };

    const handleListFocus = (e) => {
        if (e.target !== e.currentTarget) {
            return;
        }
        try {
            setKeyboardMode(e.currentTarget.matches(':focus-visible'));
        } catch {
            setKeyboardMode(false);
        }
    };

    // The number of files left by the filter, announced once the user's change has settled
    // (WCAG 4.1.3), never at the first load or at a refresh, a save or a delete.
    const [countMessage, setCountMessage] = React.useState('');
    const filterKey = `${searchInContent}|${searchTerm}`;
    const previousFilterRef = React.useRef({key: filterKey, deep: searchInContent});
    const countPendingRef = React.useRef(null);
    const latestCountRef = React.useRef({t, count: 0});
    latestCountRef.current = {t, count: processedFiles.length};
    React.useEffect(() => {
        const previous = previousFilterRef.current;
        if (previous.key === filterKey) {
            return;
        }
        countPendingRef.current = {deep: searchInContent || previous.deep !== searchInContent};
        previousFilterRef.current = {key: filterKey, deep: searchInContent};
    }, [filterKey, searchInContent]);
    React.useEffect(() => {
        const pending = countPendingRef.current;
        if (!pending || loadingFiles) {
            return undefined;
        }
        const timer = window.setTimeout(() => {
            countPendingRef.current = null;
            const {t: translate, count} = latestCountRef.current;
            setCountMessage(count === 0 ? translate('app.noFileMatches') : translate('app.fileCount', {count}));
        }, pending.deep ? DEEP_COUNT_ANNOUNCE_DELAY_MS : COUNT_ANNOUNCE_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [filterKey, loadingFiles, files]);

    const isFiltering = Boolean(searchTerm) || searchInContent;
    const showNoMatch = isFiltering && !loadingFiles && processedFiles.length === 0;

    return (
        // A region named by its heading, so that the list can be reached by landmark and by heading
        // (WCAG 1.3.1). role is explicit as the Paper of older Moonstone renders a div.
        <Paper role="region" aria-labelledby={headingId} style={{ ...PANEL_STYLE, ...SIDEBAR_PANE_FLEX, height: '100%' }}>
            <h2 id={headingId} style={VISUALLY_HIDDEN_STYLE}>{t('app.fileList')}</h2>
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
                    {/* Visual only: the switch's description stays its own, its name the label below. */}
                    <WithTooltip label={t('app.searchDeepTooltip')}>
                        <div data-cy="deep-search-toggle" style={{ display: 'flex', alignItems: 'center' }}>
                            <Switch
                                data-cy="deep-search-toggle-control"
                                id="osgi-deep-search"
                                checked={searchInContent}
                                onChange={() => setSearchInContent(!searchInContent)}
                            />
                        </div>
                    </WithTooltip>
                    <Typography variant="body" component="label" htmlFor="osgi-deep-search">{t('app.searchDeep')}</Typography>
                </div>
            </div>

            {/* Always mounted, empty until the user filters: see countMessage. */}
            <div data-cy="file-list-count" role="status" style={VISUALLY_HIDDEN_STYLE}>{countMessage}</div>

            {/* Refresh and deep search reload the list while a file is open, and showed nothing. Visual
                only: the editor pane's status region announces a load that lasts. */}
            {loadingFiles && files.length > 0 && (
                <div style={{display: 'flex', justifyContent: 'flex-start', marginBottom: '8px'}}>
                    <InlineLoader dataCy="file-list-loading" label={t('app.loadingFiles')}/>
                </div>
            )}

            {/* Outside the listbox, whose children may only be options. */}
            {showNoMatch && (
                <Typography data-cy="file-list-no-match" variant="body" style={{color: CHROME_TOKENS.subtleTextColor, padding: '8px 4px'}}>
                    {t('app.noFileMatches')}
                </Typography>
            )}

            <span id={hintId} hidden>{t('app.fileListHint')}</span>

            {/* File List: one Tab stop (the listbox), see activeName for the keys. Moonstone gives
                every row tabIndex 0, which made each file a Tab stop that Enter did not open. */}
            <div
                className="osgi-file-list"
                data-cy="file-list"
                data-keyboard={keyboardMode ? 'true' : undefined}
                role="listbox"
                aria-labelledby={headingId}
                aria-describedby={hintId}
                aria-activedescendant={activeFile ? optionId(activeFile.name) : undefined}
                style={{ flex: 1, overflowY: 'auto' }}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onFocus={handleListFocus}
                onBlur={() => setKeyboardMode(false)}
                onPointerDown={() => setKeyboardMode(false)}
            >
                <Table role="presentation" style={{ width: '100%', tableLayout: 'fixed', overflow: 'hidden' }}>
                    <TableBody role="presentation">
                        {processedFiles.map(f => {
                            const isSelected = selectedFile?.name === f.name;
                            const isActive = activeFile?.name === f.name;
                            const isUnsaved = isSelected && hasUnsaved;
                            return (
                                <TableRow
                                    key={f.path}
                                    id={optionId(f.name)}
                                    data-cy={`file-row-${encodeURIComponent(f.name)}`}
                                    data-active={isActive && keyboardMode ? 'true' : undefined}
                                    role="option"
                                    // Explicit on every option: without it, a browser may report the
                                    // active option as the selected one.
                                    aria-selected={isSelected ? 'true' : 'false'}
                                    tabIndex={undefined}
                                    isHighlighted={isSelected}
                                    onClick={() => {
                                        setActiveName(f.name);
                                        handleFileClick(f);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <TableBodyCell
                                        className="osgi-sidebar-status-cell"
                                        width="12px"
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '100%',
                                                minHeight: '48px'
                                            }}
                                        >
                                            <div data-cy={`sidebar-file-status-${encodeURIComponent(f.name)}`} aria-hidden="true" style={getFileStatusIndicatorStyle(f.enabled, isSelected)} />
                                        </div>
                                    </TableBodyCell>
                                    <TableBodyCell>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minWidth: 0, minHeight: '48px', paddingRight: '4px' }}>
                                            {/* The row the keyboard is on shows its whole name, which a hover
                                                preview cannot do for it (WCAG 1.4.13). */}
                                            <OverflowPreviewText
                                                text={f.name}
                                                wrap={isActive && keyboardMode}
                                                dataCy={`sidebar-file-name-${encodeURIComponent(f.name)}`}
                                                typographyProps={{
                                                    variant: 'body',
                                                    weight: isSelected ? 'bold' : 'default'
                                                }}
                                                wrapperStyle={{flex: 1, display: 'flex', alignItems: 'center'}}
                                                textStyle={{
                                                    color: getFilenameColor(f.name, isSelected),
                                                    textDecoration: f.enabled ? 'none' : 'line-through'
                                                }}
                                            />
                                            {/* An asterisk, as editors mark a modified file: the dot already
                                                means enabled, the pencil the User state. */}
                                            {isUnsaved && (
                                                <span data-cy="sidebar-file-unsaved" aria-hidden="true" style={{fontWeight: 'bold', flexShrink: 0}}>*</span>
                                            )}
                                            {!f.enabled && <span style={VISUALLY_HIDDEN_STYLE}>, {t('app.fileDisabled')}</span>}
                                            {isUnsaved && <span style={VISUALLY_HIDDEN_STYLE}>, {t('app.fileUnsaved')}</span>}
                                            <ConfigStateBadge state={f.configState} compact />
                                        </div>
                                    </TableBodyCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </Paper>
    );
};
