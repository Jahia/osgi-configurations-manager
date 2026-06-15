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
    AddCircleOutline
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { CfgMetatypeInfoTooltip, CfgMetatypePropertyDialog } from './CfgMetatypePropertyDialog';
import { getSuggestedPropertyValue } from '../utils/metatypeUtils';
import {CHROME_TOKENS, FLOATING_TOOLTIP_STYLE, PANEL_ACTIONS_STYLE} from './AppChrome';

const CFG_COLUMN_WIDTHS = {
    drag: {flex: '0 0 48px', minWidth: '48px'},
    type: {flex: '0 0 40px', minWidth: '40px'},
    property: {flex: '1 1 0%', minWidth: '240px'},
    value: {flex: '1 1 0%', minWidth: '240px'},
    security: {flex: '0 0 88px', minWidth: '88px'},
    actions: {flex: '0 0 48px', minWidth: '48px'}
};

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

const cfgTextInputStyle = {
    color: CHROME_TOKENS.strongTextColor,
    border: '1px solid var(--color-gray_light40)',
    borderRadius: '4px',
    padding: '6px 8px',
    transition: 'border-color 0.2s',
    width: '100%',
    background: 'var(--color-white)'
};

const cfgCommentColor = 'var(--color-success)';

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
                        style={{color: 'var(--color-success)', borderColor: 'var(--color-success)'}}
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
                    onClick={onToggleComments}
                />
                <EditorToolbarButton
                    dataCy="cfg-toggle-empty-lines"
                    tooltip={t('tooltip.toggleEmptyLines')}
                    label={t('editor.button.toggleEmptyLines')}
                    icon={showEmptyLines ? <Visibility/> : <Hidden/>}
                    variant="ghost"
                    onClick={onToggleEmptyLines}
                />
            </div>
        )}
    </div>
);

const CfgEditorHeader = ({t}) => (
    <thead>
        <TableRow>
            <TableBodyCell style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.drag}}></TableBodyCell>
            <TableBodyCell style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.type}}></TableBodyCell>

            <TableBodyCell data-cy="cfg-header-property" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.property}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.property')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell data-cy="cfg-header-value" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.value}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.value')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.security, justifyContent: 'center'}}>
                <Typography variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                    {t('editor.header.security')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.actions}}></TableBodyCell>
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
            style={{
                width: '100%',
                resize: 'none',
                overflow: 'hidden',
                minHeight: '32px', // Standard input height
                border: 'none',
                outline: 'none',
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
    const [overlay, setOverlay] = useState(null);
    const [visibleSecrets, setVisibleSecrets] = useState({});
    const [isMetatypeDialogOpen, setIsMetatypeDialogOpen] = useState(false);

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
            value: propertyDefinition ? getSuggestedPropertyValue(propertyDefinition) : ''
        }, insertIndex);
        setSelectedIndex(insertIndex);
        focusEntryValue(insertIndex);
    };

    // Modified Drag Handlers: Only active if initiated from Handle
    const handleDragStart = (e, index) => {
        // Robust check: if the event target is inside an input/textarea/button, DO NOT drag.
        // This covers Moonstone wrappers.
        if (e.target.closest('input, textarea, button, [role="button"]')) {
            e.preventDefault();
            return;
        }

        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
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

            <div style={{ flex: 1, overflow: 'auto' }} onScroll={() => setOverlay(null)}>
                <Table style={{ width: '100%' }}>
                    <CfgEditorHeader t={t} />
                    <TableBody>
                        {Array.isArray(entries) && entries.map((entry, index) => {
                            // Fix extraction logic: check for value existence before fallback
                            // use ?? to handle empty strings correctly
                            const type = entry.type?.value ?? entry.type;

                            if (!showComments && type === 'comment') {
                                return null;
                            }
                            if (!showEmptyLines && type === 'empty') {
                                return null;
                            }
                            const key = entry.key?.value ?? entry.key ?? '';
                            const value = entry.value?.value ?? entry.value ?? '';

                            const valueNode = entry.value;
                            const isEncrypted = valueNode?.encrypted;
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
                                    data-cy={`cfg-row-${index}`}
                                    style={rowStyle}
                                    className={draggedIndex === index ? "moonstone-drag" : ""}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => handleRowClick(index)}
                                >
                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.drag, cursor: 'grab' }}>
                                        <button
                                            type="button"
                                            data-cy={`cfg-reorder-${index}`}
                                            aria-label={t('editor.reorderHandle')}
                                            title={t('editor.reorderHandle')}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp' && index > 0) {
                                                    e.preventDefault();
                                                    handleReorder(index, index - 1);
                                                } else if (e.key === 'ArrowDown' && index < entries.length - 1) {
                                                    e.preventDefault();
                                                    handleReorder(index, index + 1);
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--color-gray_dark60)' }}
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
                                                <Typography variant="caption" style={{ color: 'var(--color-gray_dark40)', fontStyle: 'italic', paddingLeft: '8px' }}>
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
                                                        value={key}
                                                        onChange={e => onUpdate(index, 'key', e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        preventNewlines={true}
                                                        placeholder={t('editor.placeholder.key')}
                                                        style={cfgTextInputStyle}
                                                    />
                                                    {propertyMap.get(key) && (
                                                        <Tooltip label={<CfgMetatypeInfoTooltip property={propertyMap.get(key)} />}>
                                                            <div
                                                                data-cy={`cfg-metatype-info-${index}`}
                                                                style={{
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
                                                                i
                                                            </div>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell data-cy={`cfg-value-cell-${index}`} style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.value }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'flex-start', width: '100%', position: 'relative' }}
                                                    onMouseEnter={(e) => (isEncrypted && isSecretVisible) ? handleMouseEnter(e, value) : null}
                                                    onMouseLeave={() => setOverlay(null)}
                                                >
                                                    {isEncrypted ? (
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
                                                            style={cfgTextInputStyle}
                                                        />
                                                    )}

                                                    {isEncrypted && (
                                                        <Tooltip label={isSecretVisible ? t('tooltip.hideSecret') : t('tooltip.showSecret')}>
                                                            <Button
                                                                variant="ghost"
                                                                icon={isSecretVisible ? <Hidden /> : <Visibility />}
                                                                onClick={(e) => { e.stopPropagation(); toggleSecret(index); }}
                                                                size="small"
                                                                aria-label={isSecretVisible ? t('tooltip.hideSecret') : t('tooltip.showSecret')}
                                                                style={{ marginLeft: '4px', marginTop: '-4px' }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.security }} title={t('editor.header.security')}>
                                                <Checkbox
                                                    data-cy={`cfg-encrypted-${index}`}
                                                    aria-label={`${t('editor.header.security')}${key ? ': ' + key : ''}`}
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

                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.actions }}>
                                        <Button
                                            data-cy={`cfg-delete-${index}`}
                                            icon={<Close />}
                                            variant="ghost"
                                            color="danger"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProperty([index]);
                                            }}
                                            title={t('tooltip.deleteProperty')}
                                            aria-label={`${t('tooltip.deleteProperty')}${key ? ': ' + key : ''}`}
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
