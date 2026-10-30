import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Input,
    Checkbox,
    Button,
    Tooltip,
    Close,
    Add,
    Typography,
    Comments,
    HandleDrag,
    Visibility,
    Hidden,
    AddCircleOutline,
    SearchInput,
    ChevronUp,
    ChevronDown
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { CfgMetatypeInfoTooltip, CfgMetatypePropertyDialog } from './CfgMetatypePropertyDialog';
import { getSuggestedPropertyValue } from '../utils/metatypeUtils';
import { secretKeyTester } from '../utils/secretMask';
import {CHROME_TOKENS, FLOATING_TOOLTIP_STYLE, PANEL_ACTIONS_STYLE, VISUALLY_HIDDEN_STYLE} from './AppChrome';

const MANAGER_SELF_PID = 'org.jahia.modules.osgiconfigmanager';
const MANAGER_PASSPHRASE_KEY = 'cryptoSecret';

/**
 * True when a row matches the filter: a property whose key, or whose value when it is not a secret,
 * contains the text (case-insensitive). Comments and empty lines never match, so a filtered view
 * lists properties only. An encrypted value, or the value of a secret (see secretMask), is not
 * searched, so the filter cannot probe a secret.
 */
export const matchesCfgFilter = (entry, filter, isSecretKey = () => false) => {
    const needle = String(filter || '').trim().toLowerCase();
    if (!needle) {
        return true;
    }
    const type = entry?.type?.value ?? entry?.type;
    if (type !== 'property') {
        return false;
    }
    const key = String(entry.key?.value ?? entry.key ?? '').toLowerCase();
    const masked = Boolean(entry.value?.encrypted) || isSecretKey(entry.key?.value ?? entry.key ?? '');
    const value = masked ? '' : String(entry.value?.value ?? entry.value ?? '').toLowerCase();
    return key.includes(needle) || value.includes(needle);
};

const CFG_COLUMN_WIDTHS = {
    drag: {flex: '0 0 48px', minWidth: '48px'},
    type: {flex: '0 0 40px', minWidth: '40px'},
    property: {flex: '1 1 0%', minWidth: '240px'},
    value: {flex: '1 1 0%', minWidth: '240px'},
    security: {flex: '0 0 88px', minWidth: '88px'},
    actions: {flex: '0 0 112px', minWidth: '112px'}
};

// In a narrow editor the table scrolls sideways inside its own container (a data table may,
// under WCAG 1.4.10) rather than squeezing its columns until the headers break apart.
const CFG_TABLE_MIN_WIDTH = `${Object.values(CFG_COLUMN_WIDTHS).reduce((sum, column) => sum + parseInt(column.minWidth, 10), 0)}px`;

const cfgTableHeaderCellStyle = {
    paddingTop: '8px',
    paddingBottom: '8px'
};

const cfgRowBaseCellStyle = {
    paddingTop: '8px',
    paddingBottom: '8px',
    height: 'auto',
    alignItems: 'flex-start'
};

const cfgRowIconCellStyle = {
    ...cfgRowBaseCellStyle,
    justifyContent: 'center',
    paddingTop: '12px'
};

// The field border is the only cue that a cell is editable: gray (#7a7f88) is 4:1 on white, where
// gray_light40 was 1.14:1 (WCAG 1.4.11).
const cfgTextInputStyle = {
    color: CHROME_TOKENS.strongTextColor,
    border: '1px solid var(--color-gray)',
    borderRadius: '4px',
    padding: '6px 8px',
    transition: 'border-color 0.2s',
    width: '100%',
    background: 'var(--color-white)'
};

// success (#6abb6d) was 2.35:1 on white; success_dark is 5.6:1 (WCAG 1.4.3).
const cfgCommentColor = 'var(--color-success_dark)';

const EditorToolbarButton = ({dataCy, tooltip, ...buttonProps}) => (
    <div data-cy={dataCy}>
        <Tooltip label={tooltip}>
            <Button {...buttonProps}/>
        </Tooltip>
    </div>
);

const CfgEditorFooter = ({
    t,
    visualFormattingControlsEnabled,
    showComments,
    showEmptyLines,
    onToggleComments,
    onToggleEmptyLines,
    onAddProperty,
    onAddComment,
    onAddEmptyLine
}) => (
    <div
        data-cy="cfg-editor-footer"
        style={{
            borderTop: `1px solid ${CHROME_TOKENS.panelBorderColor}`,
            marginTop: '12px',
            paddingTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            background: CHROME_TOKENS.panelBackgroundColor
        }}
    >
        <div style={{...PANEL_ACTIONS_STYLE, gap: '8px', flexWrap: 'wrap'}}>
            <EditorToolbarButton
                dataCy="cfg-add-property"
                tooltip={t('tooltip.addProperty')}
                label={t('editor.button.addProperty')}
                icon={<Add/>}
                variant="outlined"
                color="accent"
                onClick={onAddProperty}
            />
            {visualFormattingControlsEnabled && (
                <>
                    <EditorToolbarButton
                        dataCy="cfg-add-comment"
                        tooltip={t('tooltip.addComment')}
                        label={t('editor.button.addComment')}
                        icon={<Comments/>}
                        variant="outlined"
                        style={{color: cfgCommentColor, borderColor: cfgCommentColor}}
                        onClick={onAddComment}
                    />
                    <EditorToolbarButton
                        dataCy="cfg-add-empty-line"
                        tooltip={t('tooltip.addEmptyLine')}
                        label={t('editor.button.addEmptyLine')}
                        icon={<AddCircleOutline/>}
                        variant="ghost"
                        onClick={onAddEmptyLine}
                    />
                </>
            )}
        </div>
        {visualFormattingControlsEnabled && (
            <div data-cy="cfg-editor-toolbar" style={{...PANEL_ACTIONS_STYLE, gap: '8px', flexWrap: 'wrap'}}>
                <EditorToolbarButton
                    dataCy="cfg-toggle-comments"
                    tooltip={t('tooltip.toggleComments')}
                    label={t('editor.button.toggleComments')}
                    icon={showComments ? <Visibility/> : <Hidden/>}
                    variant="ghost"
                    aria-pressed={showComments}
                    onClick={onToggleComments}
                />
                <EditorToolbarButton
                    dataCy="cfg-toggle-empty-lines"
                    tooltip={t('tooltip.toggleEmptyLines')}
                    label={t('editor.button.toggleEmptyLines')}
                    icon={showEmptyLines ? <Visibility/> : <Hidden/>}
                    variant="ghost"
                    aria-pressed={showEmptyLines}
                    onClick={onToggleEmptyLines}
                />
            </div>
        )}
    </div>
);

// Column headers are <th scope="col">, and the icon-only columns get a hidden name, so each
// field and button below is announced with its column (WCAG 1.3.1).
const CfgEditorHeader = ({t}) => (
    <thead>
        <TableRow tabIndex={undefined}>
            <TableBodyCell component="th" scope="col" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.drag}}>
                <span style={VISUALLY_HIDDEN_STYLE}>{t('editor.header.reorder')}</span>
            </TableBodyCell>
            <TableBodyCell component="th" scope="col" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.type}}>
                <span style={VISUALLY_HIDDEN_STYLE}>{t('editor.header.type')}</span>
            </TableBodyCell>

            <TableBodyCell component="th" scope="col" data-cy="cfg-header-property" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.property}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.property')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell component="th" scope="col" data-cy="cfg-header-value" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.value}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.value')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell component="th" scope="col" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.security, justifyContent: 'center'}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.security')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell component="th" scope="col" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.actions}}>
                <span style={VISUALLY_HIDDEN_STYLE}>{t('editor.header.actions')}</span>
            </TableBodyCell>
        </TableRow>
    </thead>
);

// Internal Auto-Resizing Text Area Component
const AutoResizeTextArea = ({ value, onChange, placeholder, style, onFocus, onBlur, inputRef, preventNewlines, ...props }) => {
    const textareaRef = useRef(null);

    const resize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        resize();
    }, [value]);

    useEffect(() => {
        if (inputRef && textareaRef.current) {
            inputRef(textareaRef.current);
        }
    }, [inputRef]);

    const handleKeyDown = (e) => {
        if (preventNewlines && e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleChange = (e) => {
        if (preventNewlines) {
            e.target.value = e.target.value.replace(/[\r\n]+/g, '');
        }
        resize();
        onChange(e);
    };

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            onFocus={onFocus}
            onBlur={onBlur}
            onMouseDown={(e) => e.stopPropagation()}
            // osgi-cfg-field draws the focus outline (index.jsx): outline: none left only the row
            // background, 1.14:1, to show which field had the keyboard (WCAG 2.4.7).
            className="osgi-cfg-field"
            style={{
                width: '100%',
                resize: 'none',
                overflow: 'hidden',
                minHeight: '32px', // Standard input height
                border: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                padding: '6px 0', // Alignment with other inputs
                lineHeight: '1.5',
                boxSizing: 'border-box',
                display: 'block',
                ...style
            }}
            {...props}
        />
    );
};

export const CfgEditor = ({
    entries,
    handlePropUpdate,
    handleDeleteProperty,
    handleAddCfgEntry,
    handleReorder,
    setModalConfig,
    handleToggleEncryption,
    visualFormattingControlsEnabled,
    showComments,
    handleToggleComments,
    setShowComments,
    showEmptyLines,
    handleToggleEmptyLines,
    setShowEmptyLines,
    metatypeDefinition
}) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    // A row is draggable only while the pointer is down on its handle cell: a draggable row would
    // otherwise turn every text selection in its inputs into a drag of the whole row.
    const [dragArmedIndex, setDragArmedIndex] = useState(null);
    const [filter, setFilter] = useState('');
    const filtering = filter.trim() !== '';
    const [overlay, setOverlay] = useState(null);
    const [visibleSecrets, setVisibleSecrets] = useState({});
    const [isMetatypeDialogOpen, setIsMetatypeDialogOpen] = useState(false);
    // What the last move did, for screen readers: a move changes no field they are on.
    const [reorderAnnouncement, setReorderAnnouncement] = useState('');

    // Refs map to store input references: { [index]: { key: HTMLElement, value: HTMLElement } }
    const inputRefs = useRef({});

    // Helper to register refs
    const setInputRef = (index, type, el) => {
        if (!inputRefs.current[index]) inputRefs.current[index] = {};
        inputRefs.current[index][type] = el;
    };

    // Helper to show overlay on hover if truncated
    const handleMouseEnter = (e, text) => {
        if (!text) return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();

        const estimatedWidth = text.length * 7;
        if (estimatedWidth > rect.width || text.includes('\n')) {
            setOverlay({
                text,
                top: rect.bottom + 5,
                left: rect.left,
                width: Math.max(rect.width, 300),
                minHeight: 'auto'
            });
        }
    };

    const toggleSecret = (index) => {
        setVisibleSecrets(prev => {
            const newState = { ...prev, [index]: !prev[index] };
            // If we are hiding it (newState is false), force hide overlay
            if (!newState[index]) {
                setOverlay(null);
            }
            return newState;
        });
    };

    const onUpdate = (index, field, value) => {
        handlePropUpdate([index, field], 'value', value);
    };

    const propertyMap = useMemo(() => {
        const map = new Map();
        (metatypeDefinition?.properties || []).forEach(property => {
            if (property?.id) {
                map.set(property.id, property);
            }
        });
        return map;
    }, [metatypeDefinition]);

    // A secret is masked like an encrypted value, even when it is stored in clear text: the value of
    // a module that cannot read ENC(...) stays off the screen, as in the Felix web console.
    const isSecretKey = useMemo(() => secretKeyTester(metatypeDefinition), [metatypeDefinition]);

    const existingPropertyKeys = useMemo(() => new Set(
        (Array.isArray(entries) ? entries : [])
            .filter(entry => (entry.type?.value ?? entry.type) === 'property')
            .map(entry => entry.key?.value ?? entry.key)
            .filter(Boolean)
    ), [entries]);

    const availableMetatypeProperties = useMemo(() => (
        (metatypeDefinition?.properties || []).filter(property => property?.id && !existingPropertyKeys.has(property.id))
    ), [existingPropertyKeys, metatypeDefinition]);

    const focusEntryValue = index => {
        setTimeout(() => {
            const el = inputRefs.current[index]?.value;
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    const isPasswordProperty = propertyDefinition =>
        Boolean(propertyDefinition) && String(propertyDefinition.type || '').toLowerCase() === 'password';

    // The manager's own cryptoSecret is declared as Password so it is masked, but it is the
    // passphrase ENC(...) values are encrypted with: encrypting it would leave nothing to decrypt
    // it with, and the server refuses to save it wrapped. It starts, and must stay, in clear text.
    const isEncryptionPassphrase = propertyName =>
        metatypeDefinition?.pid === MANAGER_SELF_PID && propertyName === MANAGER_PASSPHRASE_KEY;

    const insertOrFocusProperty = (propertyName, propertyDefinition) => {
        if (!propertyName) {
            return;
        }

        const existingIndex = entries.findIndex(entry => {
            const entryType = entry.type?.value ?? entry.type;
            const entryKey = entry.key?.value ?? entry.key;
            return entryType === 'property' && entryKey === propertyName;
        });

        if (existingIndex !== -1) {
            setSelectedIndex(existingIndex);
            focusEntryValue(existingIndex);
            return;
        }

        const insertIndex = selectedIndex !== null ? selectedIndex + 1 : (Array.isArray(entries) ? entries.length : 0);
        handleAddCfgEntry({
            type: 'property',
            key: propertyName,
            value: propertyDefinition ? getSuggestedPropertyValue(propertyDefinition) : '',
            // A Metatype attribute declared as Password is a secret: start the row encrypted so the
            // value is wrapped in ENC(...) on save unless the user deliberately unticks it.
            encrypted: isPasswordProperty(propertyDefinition) && !isEncryptionPassphrase(propertyName)
        }, insertIndex);
        setSelectedIndex(insertIndex);
        focusEntryValue(insertIndex);
    };

    useEffect(() => {
        const disarm = () => setDragArmedIndex(null);
        window.addEventListener('mouseup', disarm);
        window.addEventListener('touchend', disarm);
        return () => {
            window.removeEventListener('mouseup', disarm);
            window.removeEventListener('touchend', disarm);
        };
    }, []);

    // Drag handlers: a drag starts only from the handle cell (see dragArmedIndex).
    const handleDragStart = (e, index) => {
        if (dragArmedIndex !== index) {
            e.preventDefault();
            return;
        }

        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragArmedIndex(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            handleReorder(draggedIndex, dropIndex);
        }
        setDraggedIndex(null);
        setDragArmedIndex(null);
    };

    const handleRowClick = (index) => {
        setSelectedIndex(index);
    };

    const handleAdd = (type, key, value) => {
        const insertIndex = selectedIndex !== null ? selectedIndex + 1 : (Array.isArray(entries) ? entries.length : 0);

        if (type === 'property') {
            if ((metatypeDefinition?.properties || []).length > 0) {
                setIsMetatypeDialogOpen(true);
                return;
            }

            setModalConfig({
                type: 'prompt',
                title: t('modal.addProp.title'),
                message: t('modal.addProp.message'),
                onConfirm: (newKey) => {
                    if (!newKey) return;
                    insertOrFocusProperty(newKey);
                }
            });
            return;
        }

        // For comments and empty
        handleAddCfgEntry({ type, key, value }, insertIndex);
        setSelectedIndex(insertIndex);

        if (type === 'comment') {
            // Unhide comments if we are adding one
            if (!showComments) setShowComments(true);

            setTimeout(() => {
                const el = inputRefs.current[insertIndex]?.value;
                if (el) el.focus();
            }, 100);
        } else if (type === 'empty' && !showEmptyLines) {
            setShowEmptyLines(true);
        }
    };

    const handleInputFocus = (index) => {
        setSelectedIndex(index);
    };

    const isEntryShown = entry => {
        const type = entry.type?.value ?? entry.type;
        if (filtering && !matchesCfgFilter(entry, filter, isSecretKey)) {
            return false;
        }
        if (!showComments && type === 'comment') {
            return false;
        }
        return showEmptyLines || type !== 'empty';
    };
    const shownIndices = (Array.isArray(entries) ? entries : [])
        .map((entry, index) => (isEntryShown(entry) ? index : -1))
        .filter(index => index !== -1);

    // How a row is named in its controls' labels: its key, or its kind and position.
    const entryName = (entry, index) => {
        const type = entry.type?.value ?? entry.type;
        const position = index + 1;
        if (type === 'comment') {
            return t('editor.entry.comment', {position});
        }
        if (type === 'empty') {
            return t('editor.entry.emptyLine', {position});
        }
        return (entry.key?.value ?? entry.key) || t('editor.entry.property', {position});
    };

    // Moves an entry past its shown neighbour (hidden comments and empty lines are skipped), then
    // keeps the focus on the moved entry's own handle and says where it went. Rows are keyed by
    // index, so without the focus move the next Arrow key moved the neighbour back (WCAG 2.4.3).
    // Off while filtering, like the drag: only part of the rows is shown.
    const moveEntry = (index, direction, focusTarget) => {
        if (filtering) {
            return;
        }
        const position = shownIndices.indexOf(index);
        const target = shownIndices[position + direction];
        if (position === -1 || target === undefined) {
            return;
        }
        const name = entryName(entries[index], index);
        handleReorder(index, target);
        setSelectedIndex(target);
        setReorderAnnouncement(t('editor.aria.moved', {name, position: position + direction + 1, total: shownIndices.length}));
        window.requestAnimationFrame(() => {
            document.querySelector(`[data-cy="${focusTarget}-${target}"]`)?.focus();
        });
    };

    const filterCount = filtering
        ? (Array.isArray(entries) ? entries : []).filter(entry => matchesCfgFilter(entry, filter, isSecretKey)).length
        : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflow: 'hidden' }}>
            {overlay && createPortal(
                <div style={{
                    ...FLOATING_TOOLTIP_STYLE,
                    top: overlay.top,
                    left: overlay.left,
                    width: overlay.width,
                    minHeight: overlay.minHeight,
                    maxWidth: '600px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    padding: '8px 12px',
                    lineHeight: '1.4',
                    fontFamily: 'monospace'
                }}>
                    {overlay.text}
                </div>,
                document.body
            )}

            <div data-cy="cfg-filter" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div style={{flex: '1 1 auto', maxWidth: '480px'}}>
                    <SearchInput
                        value={filter}
                        aria-label={t('editor.filter.label')}
                        placeholder={t('editor.filter.placeholder')}
                        onChange={e => setFilter(e.target.value)}
                        onClear={() => setFilter('')}
                    />
                </div>
                {/* Mounted before the count appears, so screen readers announce it (WCAG 4.1.3). */}
                <div role="status">
                    {filtering && (
                        <Typography variant="caption" data-cy="cfg-filter-count" style={{color: 'var(--color-gray_dark)'}}>
                            {t('editor.filter.count', {count: filterCount})}
                        </Typography>
                    )}
                </div>
            </div>
            <div role="status" data-cy="cfg-reorder-status" style={VISUALLY_HIDDEN_STYLE}>{reorderAnnouncement}</div>

            <div style={{ flex: 1, overflow: 'auto' }} onScroll={() => setOverlay(null)}>
                <Table aria-label={t('editor.aria.table')} style={{ width: '100%', minWidth: CFG_TABLE_MIN_WIDTH }}>
                    <CfgEditorHeader t={t} />
                    <TableBody>
                        {Array.isArray(entries) && entries.map((entry, index) => {
                            // Fix extraction logic: check for value existence before fallback
                            // use ?? to handle empty strings correctly
                            const type = entry.type?.value ?? entry.type;

                            if (!isEntryShown(entry)) {
                                return null;
                            }
                            const name = entryName(entry, index);
                            const shownPosition = shownIndices.indexOf(index);
                            const canMoveUp = !filtering && shownPosition > 0;
                            const canMoveDown = !filtering && shownPosition < shownIndices.length - 1;
                            const key = entry.key?.value ?? entry.key ?? '';
                            const value = entry.value?.value ?? entry.value ?? '';

                            const valueNode = entry.value;
                            const isEncrypted = valueNode?.encrypted;
                            const isMasked = Boolean(isEncrypted) || (type === 'property' && isSecretKey(key));
                            const isSelected = selectedIndex === index;

                            const commentValue = type === 'comment' && value.startsWith('#') ? value.substring(1).trimStart() : value;
                            const isSecretVisible = visibleSecrets[index];

                            const rowStyle = {
                                cursor: 'default',
                                backgroundColor: isSelected ? CHROME_TOKENS.selectionColor : 'transparent',
                                borderBottom: '1px solid var(--color-gray_light40)',
                                height: 'auto',
                                minHeight: '48px',
                                alignItems: 'flex-start'
                            };

                            return (
                                <TableRow
                                    key={index}
                                    // Moonstone makes every row a Tab stop with nothing to do on it.
                                    tabIndex={undefined}
                                    data-cy={`cfg-row-${index}`}
                                    style={rowStyle}
                                    className={draggedIndex === index ? "moonstone-drag" : ""}
                                    draggable={dragArmedIndex === index}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => handleRowClick(index)}
                                >
                                    {/* The drag zone: the whole handle cell, wider than the icon. Reordering is
                                        off while filtering, since only part of the rows is shown. */}
                                    <TableBodyCell
                                        data-cy={`cfg-drag-zone-${index}`}
                                        style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.drag, cursor: filtering ? 'default' : 'grab' }}
                                        onMouseDown={() => { if (!filtering) setDragArmedIndex(index); }}
                                        onTouchStart={() => { if (!filtering) setDragArmedIndex(index); }}
                                    >
                                        {/* A real button, so the handle is reachable by keyboard: dragging a row
                                            was previously the only way to reorder, which excludes keyboard and
                                            assistive-technology users. Arrow Up/Down call the same handleReorder
                                            the drop handler uses. stopPropagation keeps a click on the handle from
                                            selecting the row. */}
                                        <button
                                            type="button"
                                            data-cy={`cfg-reorder-${index}`}
                                            aria-label={t('editor.aria.reorder', {name})}
                                            title={t('editor.reorderHandle')}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    moveEntry(index, -1, 'cfg-reorder');
                                                } else if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    moveEntry(index, 1, 'cfg-reorder');
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--color-gray_dark)' }}
                                        >
                                            <HandleDrag />
                                        </button>
                                    </TableBodyCell>

                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.type }}>
                                        {type === 'comment' && <Comments size="small" style={{ color: cfgCommentColor }} />}
                                    </TableBodyCell>

                                    {type === 'comment' ? (
                                        <>
                                            <TableBodyCell
                                                colSpan={2}
                                                style={{
                                                    ...cfgRowBaseCellStyle,
                                                    ...CFG_COLUMN_WIDTHS.property,
                                                    width: 'auto'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
                                                    <Typography style={{
                                                        color: cfgCommentColor,
                                                        fontWeight: 'bold',
                                                        fontSize: '14px',
                                                        lineHeight: '32px',
                                                        flexShrink: 0,
                                                        paddingLeft: '8px'
                                                    }}>#</Typography>
                                                    <AutoResizeTextArea
                                                        inputRef={el => setInputRef(index, 'value', el)}
                                                        aria-label={t('editor.aria.comment', {name})}
                                                        value={commentValue}
                                                        onChange={e => onUpdate(index, 'value', '# ' + e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        style={{
                                                            ...cfgTextInputStyle,
                                                            color: cfgCommentColor,
                                                            fontStyle: 'italic',
                                                            border: 'none',
                                                            paddingLeft: 0
                                                        }}
                                                    />
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.security }}></TableBodyCell>
                                        </>
                                    ) : type === 'empty' ? (
                                        <>
                                            <TableBodyCell style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.property }}></TableBodyCell>
                                            <TableBodyCell style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.value }}>
                                                <Typography variant="caption" style={{ color: 'var(--color-gray_dark)', fontStyle: 'italic', paddingLeft: '8px' }}>
                                                    {t('editor.emptyLine')}
                                                </Typography>
                                            </TableBodyCell>
                                            <TableBodyCell style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.security }}></TableBodyCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableBodyCell style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.property }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
                                                    <AutoResizeTextArea
                                                        inputRef={el => setInputRef(index, 'key', el)}
                                                        data-cy={`cfg-key-${index}`}
                                                        aria-label={t('editor.aria.key', {position: index + 1})}
                                                        value={key}
                                                        onChange={e => onUpdate(index, 'key', e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        preventNewlines={true}
                                                        placeholder={t('editor.placeholder.key')}
                                                        style={cfgTextInputStyle}
                                                    />
                                                    {propertyMap.get(key) && (
                                                        <Tooltip label={<CfgMetatypeInfoTooltip property={propertyMap.get(key)} />}>
                                                            {/* A button, so Tab reaches it and the tooltip opens on focus: the
                                                                property's documentation was mouse-only (WCAG 2.1.1). */}
                                                            <button
                                                                type="button"
                                                                data-cy={`cfg-metatype-info-${index}`}
                                                                aria-label={t('editor.aria.metatypeInfo', {name})}
                                                                onClick={e => e.stopPropagation()}
                                                                style={{
                                                                    padding: 0,
                                                                    fontFamily: 'inherit',
                                                                    width: '20px',
                                                                    height: '20px',
                                                                    borderRadius: '50%',
                                                                    border: '1px solid var(--color-accent_light_plain60)',
                                                                    background: 'var(--color-accent_light_plain20)',
                                                                    color: 'var(--color-accent_dark)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '12px',
                                                                    fontWeight: 700,
                                                                    cursor: 'help',
                                                                    marginTop: '6px',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                <span aria-hidden="true">i</span>
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell data-cy={`cfg-value-cell-${index}`} style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.value }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'flex-start', width: '100%', position: 'relative' }}
                                                    onMouseEnter={(e) => (isMasked && isSecretVisible) ? handleMouseEnter(e, value) : null}
                                                    onMouseLeave={() => setOverlay(null)}
                                                >
                                                    {isMasked ? (
                                                        <div
                                                            style={{ flex: 1, display: 'flex' }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            draggable={false}
                                                            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        >
                                                            <Input
                                                                // @ts-ignore
                                                                inputRef={el => setInputRef(index, 'value', el)}
                                                                // Actually Input forwards ref. We can use ref={el => ...}
                                                                ref={el => setInputRef(index, 'value', el)}
                                                                data-cy={`cfg-value-${index}`}
                                                                value={value}
                                                                onChange={e => onUpdate(index, 'value', e.target.value)}
                                                                onFocus={() => handleInputFocus(index)}
                                                                placeholder={t('editor.placeholder.value')}
                                                                aria-label={t('editor.aria.value', {name})}
                                                                // Keeps the browser from filling in the admin's saved password.
                                                                autoComplete="new-password"
                                                                type={!isSecretVisible ? 'password' : 'text'}
                                                                style={{ ...cfgTextInputStyle, width: '100%' }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <AutoResizeTextArea
                                                            inputRef={el => setInputRef(index, 'value', el)}
                                                            data-cy={`cfg-value-${index}`}
                                                            value={value}
                                                            onChange={e => onUpdate(index, 'value', e.target.value)}
                                                            onFocus={() => handleInputFocus(index)}
                                                            // preventNewlines={true} // Allow newlines for values!
                                                            placeholder={t('editor.placeholder.value')}
                                                            aria-label={t('editor.aria.value', {name})}
                                                            style={cfgTextInputStyle}
                                                        />
                                                    )}

                                                    {isMasked && (
                                                        <Tooltip label={isSecretVisible ? t('tooltip.hideSecret') : t('tooltip.showSecret')}>
                                                            <Button
                                                                variant="ghost"
                                                                icon={isSecretVisible ? <Hidden /> : <Visibility />}
                                                                onClick={(e) => { e.stopPropagation(); toggleSecret(index); }}
                                                                size="small"
                                                                aria-label={isSecretVisible ? t('editor.aria.hideSecret', {name}) : t('editor.aria.showSecret', {name})}
                                                                style={{ marginLeft: '4px', marginTop: '-4px' }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.security }} title={t('editor.header.security')}>
                                                <Checkbox
                                                    data-cy={`cfg-encrypted-${index}`}
                                                    // The title on the cell does not name the input (WCAG 4.1.2).
                                                    aria-label={t('editor.encryptValueOf', {key: key || `#${index + 1}`})}
                                                    checked={isEncrypted || false}
                                                    onChange={() => {
                                                        // Sync toggle: Just flip the flag
                                                        // handleToggleEncryption passed from parent handles the flag logic
                                                        handleToggleEncryption([index, 'value'], isEncrypted, value);
                                                    }}
                                                />
                                            </TableBodyCell>
                                        </>
                                    )}

                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.actions, gap: '2px' }}>
                                        {/* Move up / down in one click: dragging was the only way with a pointer
                                            (WCAG 2.5.7). Out of the Tab order, where the handle's arrow keys
                                            already do it, so a row does not cost two more Tab stops. */}
                                        <Button
                                            data-cy={`cfg-move-up-${index}`}
                                            icon={<ChevronUp />}
                                            variant="ghost"
                                            size="small"
                                            tabIndex={-1}
                                            isDisabled={!canMoveUp}
                                            aria-label={t('editor.aria.moveUp', {name})}
                                            title={t('editor.aria.moveUp', {name})}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveEntry(index, -1, 'cfg-reorder');
                                            }}
                                        />
                                        <Button
                                            data-cy={`cfg-move-down-${index}`}
                                            icon={<ChevronDown />}
                                            variant="ghost"
                                            size="small"
                                            tabIndex={-1}
                                            isDisabled={!canMoveDown}
                                            aria-label={t('editor.aria.moveDown', {name})}
                                            title={t('editor.aria.moveDown', {name})}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveEntry(index, 1, 'cfg-reorder');
                                            }}
                                        />
                                        <Button
                                            data-cy={`cfg-delete-${index}`}
                                            icon={<Close />}
                                            variant="ghost"
                                            color="danger"
                                            size="small"
                                            aria-label={t('editor.aria.delete', {name})}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProperty([index]);
                                            }}
                                            title={t('tooltip.deleteProperty')}
                                        />
                                    </TableBodyCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <CfgEditorFooter
                t={t}
                visualFormattingControlsEnabled={visualFormattingControlsEnabled}
                showComments={showComments}
                showEmptyLines={showEmptyLines}
                onToggleComments={handleToggleComments}
                onToggleEmptyLines={handleToggleEmptyLines}
                onAddProperty={() => handleAdd('property', '', '')}
                onAddComment={() => handleAdd('comment', undefined, '# ')}
                onAddEmptyLine={() => handleAdd('empty', undefined, '')}
            />
            <CfgMetatypePropertyDialog
                open={isMetatypeDialogOpen}
                properties={availableMetatypeProperties}
                existingKeys={existingPropertyKeys}
                onClose={() => setIsMetatypeDialogOpen(false)}
                onSelectMetatypeProperty={property => insertOrFocusProperty(property.id, property)}
                onCreateCustomProperty={propertyName => insertOrFocusProperty(propertyName)}
            />
        </div>
    );
};
