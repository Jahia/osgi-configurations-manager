import React from 'react';
import {
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Typography,
    Input,
    Checkbox,
    Button,
    Folder,
    Close,
    Add,
    Tooltip,
    ChevronDown,
    ChevronRight
} from '@jahia/moonstone';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// Custom Textarea-like component using Input if Moonstone doesn't have one easily accessible
// or just using standard textarea for simplicity in complex cases
const MultilineInput = ({ value, onChange, onBlur }) => (
    <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoFocus
        style={{
            width: '100%',
            minHeight: '80px',
            fontFamily: 'monospace',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            position: 'relative',
            zIndex: 10
        }}
    />
);

const LeafRow = ({ level, rowLabel, node, keyString, currentPath, editingValueKey, setEditingValueKey, handlePropUpdate, handleDeleteProperty, onShowOverlay, onHideOverlay, t }) => {
    const isMultiline = node.value && (node.value.includes('\n') || node.value.length > 50);

    const handleMouseEnter = (e, text) => {
        const el = e.currentTarget;
        if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
            const rect = el.getBoundingClientRect();
            onShowOverlay({
                text,
                top: rect.top,
                left: rect.left,
                width: rect.width,
                minHeight: rect.height
            });
        }
    };

    return (
        <TableRow key={keyString}>
            <TableBodyCell
                style={{
                    flex: '0 0 25%',
                    paddingLeft: `${level * 20 + 20}px`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}
            >
                <div
                    onMouseEnter={(e) => handleMouseEnter(e, rowLabel)}
                    onMouseLeave={onHideOverlay}
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%'
                    }}
                >
                    <Typography variant="caption">{rowLabel}</Typography>
                </div>
            </TableBodyCell>
            <TableBodyCell style={{ flex: 1, minWidth: 0 }}>
                {editingValueKey === keyString ? (
                    isMultiline ? (
                        <MultilineInput
                            value={node.value}
                            onChange={e => handlePropUpdate(currentPath, 'value', e.target.value)}
                            onBlur={() => setEditingValueKey(null)}
                        />
                    ) : (
                        <Input
                            value={node.value}
                            onChange={e => handlePropUpdate(currentPath, 'value', e.target.value)}
                            onBlur={() => setEditingValueKey(null)}
                            autoFocus
                            style={{ backgroundColor: '#ffffff' }}
                        />
                    )
                ) : (
                    <div
                        onMouseEnter={(e) => handleMouseEnter(e, node.value || '')}
                        onMouseLeave={onHideOverlay}
                        onDoubleClick={() => { onHideOverlay(); setEditingValueKey(keyString); }}
                        style={{
                            minHeight: '20px',
                            cursor: 'text',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            fontFamily: isMultiline ? 'monospace' : 'inherit',
                            fontSize: isMultiline ? '0.8rem' : 'inherit',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {node.encrypted ? '*****' : (node.value || <span style={{ color: '#ccc', fontStyle: 'italic' }}>{t('editor.empty')}</span>)}
                    </div>
                )}
            </TableBodyCell>
            <TableBodyCell style={{ flex: '0 0 80px', justifyContent: 'center' }}>
                <Checkbox
                    checked={node.encrypted}
                    onChange={() => handlePropUpdate(currentPath, 'encrypted', !node.encrypted)}
                />
            </TableBodyCell>
            <TableBodyCell style={{ flex: '0 0 80px', justifyContent: 'center' }}>
                <Button
                    icon={<Close />}
                    variant="ghost"
                    color="danger"
                    size="small"
                    onClick={() => handleDeleteProperty(currentPath)}
                    title={t('tooltip.deleteProperty')}
                />
            </TableBodyCell>
        </TableRow >
    );
};

const ContainerRow = ({ level, displayLabel, isCollapsed, toggleCollapse, isArrayItem, onAddProperty, onShowOverlay, onHideOverlay, t }) => {
    const handleMouseEnter = (e) => {
        const el = e.currentTarget;
        if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
            const rect = el.getBoundingClientRect();
            onShowOverlay({
                text: displayLabel,
                top: rect.top,
                left: rect.left,
                width: rect.width,
                minHeight: rect.height
            });
        }
    };

    return (
        <TableRow>
            <TableBodyCell
                colSpan={4}
                style={{
                    paddingLeft: `${level * 20 + 10}px`,
                    background: level === 0 ? 'linear-gradient(90deg, #f0f4f7 0%, #ffffff 100%)' : '#fafafa',
                    borderLeft: level > 0 ? '4px solid #007cb0' : 'none',
                    cursor: 'pointer',
                    position: 'relative'
                }}
                onClick={toggleCollapse}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isCollapsed ? <ChevronRight size="small" /> : <ChevronDown size="small" />}
                        <Folder size="small" style={{ color: '#007cb0' }} />
                        <Typography
                            weight="bold"
                            variant="caption"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={onHideOverlay}
                            style={{
                                textTransform: (isArrayItem && !displayLabel.includes(':')) ? 'uppercase' : 'none',
                                letterSpacing: (isArrayItem && !displayLabel.includes(':')) ? '1px' : 'normal',
                                fontFamily: displayLabel.startsWith('-') ? 'monospace' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block'
                            }}
                        >
                            {displayLabel}
                        </Typography>
                    </div>
                    {!isCollapsed && (
                        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                            <Button
                                size="small"
                                label={t('editor.button.addProperty')}
                                icon={<Add />}
                                color="accent"
                                variant="ghost"
                                onClick={onAddProperty}
                                title={t('tooltip.addProperty')}
                            />
                        </div>
                    )}
                </div>
            </TableBodyCell>
        </TableRow>
    );
};

const RowRenderer = ({ data, path = [], level = 0, collapsedPaths, toggleCollapse, handlePropUpdate, handleAddProperty, handleAddItem, handleDeleteProperty, editingValueKey, setEditingValueKey, onShowOverlay, onHideOverlay, t }) => {
    if (!data) return null;
    const keys = data._order || Object.keys(data).filter(k => k !== '_order');

    return keys.map(key => {
        const node = data[key];
        if (key === '_order' || node === undefined) return null;

        const currentPath = [...path, Array.isArray(data) ? Number(key) : key];
        const keyString = currentPath.join('.');
        const rowLabel = Array.isArray(data) ? '-' : key;

        if (node.isLeaf) {
            return (
                <LeafRow
                    key={keyString}
                    level={level}
                    rowLabel={rowLabel}
                    node={node}
                    keyString={keyString}
                    currentPath={currentPath}
                    editingValueKey={editingValueKey}
                    setEditingValueKey={setEditingValueKey}
                    handlePropUpdate={handlePropUpdate}
                    handleDeleteProperty={handleDeleteProperty}
                    onShowOverlay={onShowOverlay}
                    onHideOverlay={onHideOverlay}
                    t={t}
                />
            );
        }

        const isCollapsed = collapsedPaths.has(keyString);
        let childrenData = Array.isArray(node) ? [...node] : { ...node };

        return (
            <React.Fragment key={keyString}>
                <ContainerRow
                    level={level}
                    displayLabel={key}
                    isCollapsed={isCollapsed}
                    toggleCollapse={() => toggleCollapse(keyString)}
                    isArrayItem={Array.isArray(data)}
                    onAddProperty={() => handleAddProperty(currentPath)}
                    onShowOverlay={onShowOverlay}
                    onHideOverlay={onHideOverlay}
                    t={t}
                />
                {!isCollapsed && (
                    <RowRenderer
                        data={childrenData}
                        path={currentPath}
                        level={level + 1}
                        collapsedPaths={collapsedPaths}
                        toggleCollapse={toggleCollapse}
                        handlePropUpdate={handlePropUpdate}
                        handleAddProperty={handleAddProperty}
                        handleAddItem={handleAddItem}
                        handleDeleteProperty={handleDeleteProperty}
                        editingValueKey={editingValueKey}
                        setEditingValueKey={setEditingValueKey}
                        onShowOverlay={onShowOverlay}
                        onHideOverlay={onHideOverlay}
                        t={t}
                    />
                )}
            </React.Fragment>
        );
    });
};

export const ConfigEditor = ({ properties, collapsedPaths, toggleCollapse, handlePropUpdate, handleAddProperty, handleAddItem, handleDeleteProperty }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [editingValueKey, setEditingValueKey] = React.useState(null);
    const [overlay, setOverlay] = React.useState(null);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflow: 'hidden' }}>
            {overlay && createPortal(
                <div style={{
                    position: 'fixed',
                    top: overlay.top,
                    left: overlay.left,
                    width: overlay.width,
                    minHeight: overlay.minHeight,
                    backgroundColor: '#fff',
                    color: '#333',
                    zIndex: 1000000,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontSize: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderLeft: '4px solid #00a0e3',
                    pointerEvents: 'none',
                    padding: '0 4px', // Slight horizontal padding, no vertical
                    lineHeight: '1.5',
                    fontFamily: 'inherit'
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
                    onClick={() => handleAddProperty([])}
                    title={t('tooltip.addProperty')}
                />
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} onScroll={() => setOverlay(null)}>
                <Table style={{ width: '100%' }}>
                    <thead>
                        <TableRow>
                            <TableBodyCell style={{ flex: '0 0 25%', position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}><Typography variant="caption" weight="bold">{t('editor.header.property')}</Typography></TableBodyCell>
                            <TableBodyCell style={{ flex: 1, position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}><Typography variant="caption" weight="bold">{t('editor.header.value')}</Typography></TableBodyCell>
                            <TableBodyCell style={{ flex: '0 0 80px', justifyContent: 'center', position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}><Typography variant="caption" weight="bold">{t('editor.header.security')}</Typography></TableBodyCell>
                            <TableBodyCell style={{ flex: '0 0 80px', justifyContent: 'center', position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}><Typography variant="caption" weight="bold">{t('editor.header.actions')}</Typography></TableBodyCell>
                        </TableRow>
                    </thead>
                    <TableBody>
                        <RowRenderer
                            data={properties}
                            collapsedPaths={collapsedPaths}
                            toggleCollapse={toggleCollapse}
                            handlePropUpdate={handlePropUpdate}
                            handleAddProperty={handleAddProperty}
                            handleAddItem={handleAddItem}
                            handleDeleteProperty={handleDeleteProperty}
                            editingValueKey={editingValueKey}
                            setEditingValueKey={setEditingValueKey}
                            onShowOverlay={setOverlay}
                            onHideOverlay={() => setOverlay(null)}
                            t={t}
                        />
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
