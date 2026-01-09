import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Input,
    Checkbox,
    Button,
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

// Internal Auto-Resizing Text Area Component
const AutoResizeTextArea = ({ value, onChange, placeholder, style, onFocus, onBlur, ...props }) => {
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

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => {
                resize();
                onChange(e);
            }}
            placeholder={placeholder}
            onFocus={onFocus}
            onBlur={onBlur}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                ...style,
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
                display: 'block'
            }}
            {...props}
        />
    );
};

export const CfgEditor = ({ entries, handlePropUpdate, handleDeleteProperty, handleAddCfgEntry, handleReorder }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [overlay, setOverlay] = useState(null);
    const [visibleSecrets, setVisibleSecrets] = useState({});

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
        // Insert AFTER the selected index, or at the end if nothing selected
        const insertIndex = selectedIndex !== null ? selectedIndex + 1 : undefined;
        handleAddCfgEntry({ type, key, value }, insertIndex);
        // Move selection to the new item (optional, but good UX)
        if (insertIndex !== undefined) {
            setSelectedIndex(insertIndex);
        } else if (Array.isArray(entries)) {
            setSelectedIndex(entries.length);
        }
    };

    const handleInputFocus = (index) => {
        setSelectedIndex(index);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflow: 'hidden' }}>
            {overlay && createPortal(
                <div style={{
                    position: 'fixed',
                    top: overlay.top,
                    left: overlay.left,
                    width: overlay.width,
                    minHeight: overlay.minHeight,
                    maxWidth: '600px',
                    backgroundColor: '#1E1E1E',
                    color: '#fff',
                    zIndex: 1000000,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.875rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    padding: '8px 12px',
                    lineHeight: '1.4',
                    fontFamily: 'monospace'
                }}>
                    {overlay.text}
                </div>,
                document.body
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button
                    label={t('editor.button.addProperty')}
                    icon={<Add />}
                    color="accent"
                    onClick={() => handleAdd('property', '', '')}
                    title={t('tooltip.addProperty')}
                />
                <Button
                    label={t('editor.button.addComment')}
                    icon={<Comments />}
                    variant="outlined"
                    style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                    onClick={() => handleAdd('comment', undefined, '# ')}
                    title={t('tooltip.addComment')}
                />
                <Button
                    label={t('editor.button.addEmptyLine')}
                    icon={<AddCircleOutline />}
                    variant="ghost"
                    onClick={() => handleAdd('empty', undefined, '')}
                    title={t('editor.button.addEmptyLine')}
                />
            </div>

            <div style={{ flex: 1, overflow: 'auto' }} onScroll={() => setOverlay(null)}>
                <Table style={{ width: '100%' }}>
                    <thead>
                        <TableRow>
                            <TableBodyCell style={{ flex: '0 0 48px', minWidth: '48px' }}></TableBodyCell>
                            <TableBodyCell style={{ flex: '0 0 40px', minWidth: '40px' }}></TableBodyCell>

                            <TableBodyCell style={{ flex: '0 0 15%', width: '15%', minWidth: '150px' }}>
                                <Typography variant="caption" weight="bold" style={{ color: '#000' }}>{t('editor.header.property')}</Typography>
                            </TableBodyCell>

                            <TableBodyCell style={{ flex: '1 1 auto', minWidth: 0 }}>
                                <Typography variant="caption" weight="bold" style={{ color: '#000' }}>{t('editor.header.value')}</Typography>
                            </TableBodyCell>

                            <TableBodyCell style={{ flex: '0 0 80px', justifyContent: 'center', minWidth: '80px' }}>
                                <Typography variant="caption" weight="bold" style={{ color: '#000' }}>{t('editor.header.security')}</Typography>
                            </TableBodyCell>

                            <TableBodyCell style={{ flex: '0 0 48px', minWidth: '48px' }}></TableBodyCell>
                        </TableRow>
                    </thead>
                    <TableBody>
                        {Array.isArray(entries) && entries.map((entry, index) => {
                            const type = entry.type?.value;
                            const key = entry.key?.value || '';
                            const value = entry.value?.value || '';
                            const valueNode = entry.value;
                            const isEncrypted = valueNode?.encrypted;
                            const isSelected = selectedIndex === index;

                            const commentValue = type === 'comment' && value.startsWith('#') ? value.substring(1).trimStart() : value;
                            const isSecretVisible = visibleSecrets[index];

                            const rowStyle = {
                                cursor: 'default',
                                backgroundColor: isSelected ? '#E3F2FD' : 'transparent',
                                borderBottom: '1px solid var(--color-gray_light40)',
                                height: 'auto',
                                minHeight: '48px',
                                alignItems: 'flex-start'
                            };

                            const cellStyle = {
                                paddingTop: '8px',
                                paddingBottom: '8px',
                                height: 'auto',
                                alignItems: 'flex-start'
                            };

                            const textInputStyle = {
                                color: '#000',
                            };

                            const iconCellStyle = {
                                ...cellStyle,
                                justifyContent: 'center',
                                paddingTop: '12px'
                            };

                            return (
                                <TableRow
                                    key={index}
                                    style={rowStyle}
                                    className={draggedIndex === index ? "moonstone-drag" : ""}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => handleRowClick(index)}
                                >
                                    <TableBodyCell style={{ ...iconCellStyle, flex: '0 0 48px', minWidth: '48px', cursor: 'grab' }}>
                                        <HandleDrag style={{ color: 'var(--color-gray_dark60)' }} />
                                    </TableBodyCell>

                                    <TableBodyCell style={{ ...iconCellStyle, flex: '0 0 40px', minWidth: '40px' }}>
                                        {type === 'comment' && <Comments size="small" style={{ color: 'var(--color-gray_dark60)' }} />}
                                    </TableBodyCell>

                                    {type === 'comment' ? (
                                        <>
                                            <TableBodyCell style={{ ...cellStyle, flex: '0 0 15%', width: '15%', minWidth: '150px' }}>
                                                <Typography style={{
                                                    color: 'var(--color-success)',
                                                    fontWeight: 'bold',
                                                    fontSize: '14px',
                                                    paddingLeft: '8px'
                                                }}>#</Typography>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cellStyle, flex: '1 1 auto', minWidth: 0 }}>
                                                <div
                                                    style={{ width: '100%' }}
                                                >
                                                    <AutoResizeTextArea
                                                        value={commentValue}
                                                        onChange={e => onUpdate(index, 'value', '# ' + e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        style={{
                                                            color: 'var(--color-success)',
                                                            fontStyle: 'italic',
                                                        }}
                                                    />
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cellStyle, flex: '0 0 80px', minWidth: '80px' }}></TableBodyCell>
                                        </>
                                    ) : type === 'empty' ? (
                                        <>
                                            <TableBodyCell style={{ ...cellStyle, flex: '0 0 15%', width: '15%', minWidth: '150px' }}></TableBodyCell>
                                            <TableBodyCell style={{ ...cellStyle, flex: '1 1 auto', minWidth: 0 }}>
                                                <Typography variant="caption" style={{ color: 'var(--color-gray_dark40)', fontStyle: 'italic', paddingLeft: '8px' }}>
                                                    {t('editor.emptyLine')}
                                                </Typography>
                                            </TableBodyCell>
                                            <TableBodyCell style={{ ...cellStyle, flex: '0 0 80px', minWidth: '80px' }}></TableBodyCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableBodyCell style={{ ...cellStyle, flex: '0 0 15%', width: '15%', minWidth: '150px' }}>
                                                <div
                                                    style={{ width: '100%' }}
                                                >
                                                    <AutoResizeTextArea
                                                        value={key}
                                                        onChange={e => onUpdate(index, 'key', e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        placeholder="Key"
                                                        style={textInputStyle}
                                                    />
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cellStyle, flex: '1 1 auto', minWidth: 0 }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'flex-start', width: '100%', position: 'relative' }}
                                                    // Only show tooltip if Encrypted AND Visible, OR if using Fixed height Input (which we are for encrypted)
                                                    // Logic: If encrypted, verify visibility. 
                                                    onMouseEnter={(e) => (isEncrypted && isSecretVisible) ? handleMouseEnter(e, value) : null}
                                                    onMouseLeave={() => setOverlay(null)}
                                                >
                                                    {isEncrypted ? (
                                                        <div
                                                            style={{ flex: 1, display: 'flex' }}
                                                            // STRICT DnD and Event Blocking
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            draggable={false}
                                                            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        >
                                                            <Input
                                                                value={value}
                                                                onChange={e => onUpdate(index, 'value', e.target.value)}
                                                                onFocus={() => handleInputFocus(index)}
                                                                placeholder="Value"
                                                                type={!isSecretVisible ? 'password' : 'text'}
                                                                style={{ ...textInputStyle, width: '100%' }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <AutoResizeTextArea
                                                            value={value}
                                                            onChange={e => onUpdate(index, 'value', e.target.value)}
                                                            onFocus={() => handleInputFocus(index)}
                                                            placeholder="Value"
                                                            style={textInputStyle}
                                                        />
                                                    )}

                                                    {isEncrypted && (
                                                        <Button
                                                            variant="ghost"
                                                            icon={isSecretVisible ? <Hidden /> : <Visibility />}
                                                            onClick={(e) => { e.stopPropagation(); toggleSecret(index); }}
                                                            size="small"
                                                            style={{ marginLeft: '4px', marginTop: '-4px' }}
                                                        />
                                                    )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...iconCellStyle, flex: '0 0 80px', minWidth: '80px' }} title={t('editor.header.security')}>
                                                <Checkbox
                                                    checked={isEncrypted || false}
                                                    onChange={() => handlePropUpdate([index, 'value'], 'encrypted', !isEncrypted)}
                                                />
                                            </TableBodyCell>
                                        </>
                                    )}

                                    <TableBodyCell style={{ ...iconCellStyle, flex: '0 0 48px', minWidth: '48px' }}>
                                        <Button
                                            icon={<Close />}
                                            variant="ghost"
                                            color="danger"
                                            size="small"
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
        </div>
    );
};
