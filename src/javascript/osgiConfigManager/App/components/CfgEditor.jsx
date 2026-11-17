import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WithTooltip } from './WithTooltip';
import {
    Table,
    TableBody,
    TableRow,
    TableBodyCell,
    Checkbox,
    Button,
    Tooltip,
    Delete,
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
import { formatDefaultValue, getSuggestedPropertyValue } from '../utils/metatypeUtils';
import { findKeyProblems } from '../utils/configUtils';
import { secretKeyTester } from '../utils/secretMask';
import {CHROME_TOKENS, FLOATING_TOOLTIP_STYLE, PANEL_ACTIONS_STYLE, scrollBehavior, VISUALLY_HIDDEN_STYLE} from './AppChrome';

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

// The minimums fit the editor beside the file list at 1440px (about 560px): at 768px, Security and
// the row actions were scrolled out of view at 100% zoom.
const CFG_COLUMN_WIDTHS = {
    drag: {flex: '0 0 40px', minWidth: '40px'},
    type: {flex: '0 0 32px', minWidth: '32px'},
    property: {flex: '1 1 0%', minWidth: '120px'},
    value: {flex: '1 1 0%', minWidth: '140px'},
    security: {flex: '0 0 88px', minWidth: '88px'},
    actions: {flex: '0 0 96px', minWidth: '96px'}
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

// An error is said in words under the field, and drawn in a colour of at least 3:1 (WCAG 1.4.11).
const cfgErrorColor = 'var(--color-danger_dark)';

const VALUE_HINT_MAX_OPTIONS = 5;

// What a value must look like, from the Metatype, said under the field: every type was edited as free
// text with nothing to tell a Boolean or a number from a string (WCAG 3.3.2). Text stays free, for
// lists and ${...} placeholders. Nothing for a string or a password, which take anything.
export const valueHintFor = (property, t) => {
    if (!property) {
        return '';
    }
    let hint = '';
    const options = Array.isArray(property.options) ? property.options.filter(option => option?.value) : [];
    if (options.length > 0) {
        const values = options.slice(0, VALUE_HINT_MAX_OPTIONS).map(option => option.value).join(', ');
        const rest = options.length - VALUE_HINT_MAX_OPTIONS;
        hint = t('editor.valueHint.options', {values: rest > 0 ? t('editor.valueHint.more', {values, count: rest}) : values});
    } else {
        const type = String(property.type || '').toLowerCase();
        if (type === 'boolean') {
            hint = t('editor.valueHint.boolean');
        } else if (['integer', 'long', 'short', 'byte'].includes(type)) {
            hint = t('editor.valueHint.wholeNumber');
        } else if (['double', 'float'].includes(type)) {
            hint = t('editor.valueHint.number');
        } else if (['char', 'character'].includes(type)) {
            hint = t('editor.valueHint.character');
        }
    }
    if (hint && property.cardinality && Number(property.cardinality) !== 0) {
        hint = `${hint} (${t('editor.valueHint.list')})`;
    }
    return hint;
};

// Metatype's required is true unless the author says otherwise, so most attributes are: only one
// with no default leaves the user to find a value, and is marked.
const isRequiredWithoutDefault = property => Boolean(property) && property.optional === false && !formatDefaultValue(property);

const supportsFieldSizing = () => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');

const EditorToolbarButton = ({dataCy, tooltip, ...buttonProps}) => (
    <div data-cy={dataCy}>
        <WithTooltip label={tooltip}>
            <Button {...buttonProps}/>
        </WithTooltip>
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
    onAddEmptyLine,
    insertDescriptionId
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
                aria-describedby={insertDescriptionId}
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
                        aria-describedby={insertDescriptionId}
                        onClick={onAddComment}
                    />
                    <EditorToolbarButton
                        dataCy="cfg-add-empty-line"
                        tooltip={t('tooltip.addEmptyLine')}
                        label={t('editor.button.addEmptyLine')}
                        icon={<AddCircleOutline/>}
                        variant="ghost"
                        aria-describedby={insertDescriptionId}
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
                    {t('editor.header.encrypted')}
                </Typography>
            </TableBodyCell>

            <TableBodyCell component="th" scope="col" style={{...cfgTableHeaderCellStyle, ...CFG_COLUMN_WIDTHS.actions}}>
                <span style={VISUALLY_HIDDEN_STYLE}>{t('editor.header.actions')}</span>
            </TableBodyCell>
        </TableRow>
    </thead>
);

// A one-line field that grows with its text. field-sizing: content lets the browser size it, so that
// user text spacing or zoom never cuts it (WCAG 1.4.12); elsewhere it is sized from its scrollHeight,
// again when its width changes, and scrolls rather than hides what still does not fit.
const AutoResizeTextArea = ({ value, onChange, placeholder, style, onFocus, onBlur, inputRef, preventNewlines, ...props }) => {
    const textareaRef = useRef(null);
    const [fieldSizing] = useState(supportsFieldSizing);

    const resize = () => {
        const el = textareaRef.current;
        if (el && !fieldSizing) {
            el.style.height = 'auto';
            // border-box: the borders on top of the content, or a scrollbar shows on every field.
            el.style.height = el.scrollHeight + (el.offsetHeight - el.clientHeight) + 'px';
        }
    };

    useEffect(() => {
        resize();
    }, [value]);

    useEffect(() => {
        const el = textareaRef.current;
        if (fieldSizing || !el || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        // Only on a width change: setting the height would otherwise call the observer again.
        let width = el.getBoundingClientRect().width;
        let frame = null;
        const observer = new ResizeObserver(entries => {
            const nextWidth = entries[0]?.contentRect.width;
            if (nextWidth === undefined || nextWidth === width) {
                return;
            }
            width = nextWidth;
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(resize);
        });
        observer.observe(el);
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [fieldSizing]);

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
                overflowY: 'auto',
                fieldSizing: fieldSizing ? 'content' : undefined,
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
    metatypeDefinition,
    showKeyProblems = false,
    keyProblemsFocusRequest = 0
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
    // Escape dismisses the revealed-secret overlay (WCAG 1.4.13).
    useEffect(() => {
        if (!overlay) {
            return undefined;
        }
        const onKeyDown = event => {
            if (event.key === 'Escape') {
                setOverlay(null);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [overlay]);
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
                el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
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
            if (filtering) {
                setFilter('');
            }
            setSelectedIndex(existingIndex);
            focusEntryValue(existingIndex);
            return;
        }

        const insertIndex = insertionIndex();
        // A row added while filtering may not match the filter, and the focus would find nothing.
        if (filtering) {
            setFilter('');
        }
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
            // The selection follows the moved row, as with the arrow keys.
            setSelectedIndex(dropIndex);
        }
        setDraggedIndex(null);
        setDragArmedIndex(null);
    };

    const handleRowClick = (index) => {
        setSelectedIndex(index);
    };

    const handleAdd = (type, key, value) => {
        const insertIndex = insertionIndex();

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

        // For comments and empty, which never match a filter.
        if (filtering) {
            setFilter('');
        }
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
        announce(t('editor.aria.moved', {name, position: position + direction + 1, total: shownIndices.length}));
        window.requestAnimationFrame(() => {
            document.querySelector(`[data-cy="${focusTarget}-${target}"]`)?.focus();
        });
    };

    const filterCount = filtering
        ? (Array.isArray(entries) ? entries : []).filter(entry => matchesCfgFilter(entry, filter, isSecretKey)).length
        : null;

    // The selection decides where Add inserts. One that is gone (deleted, or past the end) or hidden
    // (filter, toggles) counts as none: Add went after a row the user could not see.
    const selectedShown = selectedIndex !== null && shownIndices.includes(selectedIndex) ? selectedIndex : null;
    function insertionIndex() {
        return selectedShown !== null ? selectedShown + 1 : (Array.isArray(entries) ? entries.length : 0);
    }
    const insertDescriptionId = React.useId();
    const insertDescription = selectedShown !== null
        ? t('editor.insertPosition.after', {name: entryName(entries[selectedShown], selectedShown)})
        : t('editor.insertPosition.end');

    // Cleared first and set on the next frame: the same text twice (two "empty line 4 deleted") changed
    // no node, and the second was not announced.
    function announce(text) {
        setReorderAnnouncement('');
        window.requestAnimationFrame(() => setReorderAnnouncement(text));
    }

    // What the rows are after the last render, for the delete dialog's focus resolver, which runs on
    // a later frame.
    const latestRef = useRef({shown: shownIndices});
    latestRef.current = {shown: shownIndices};

    // After a confirmed delete, the focus goes to the row that took the deleted one's place, else the
    // one before it, else Add Property, and the deletion is said: it went back to the Delete button
    // of whichever row now had that index, or to <body> for the last row (WCAG 2.4.3, 4.1.3).
    const requestDelete = index => {
        const name = entryName(entries[index], index);
        handleDeleteProperty([index], {
            name,
            returnFocus: () => {
                const {shown} = latestRef.current;
                setSelectedIndex(previous => {
                    if (previous === null || previous === index) {
                        return null;
                    }
                    return previous > index ? previous - 1 : previous;
                });
                const next = shown.find(shownIndex => shownIndex >= index);
                const target = next !== undefined ? next : [...shown].reverse().find(shownIndex => shownIndex < index);
                let element = null;
                if (target !== undefined) {
                    const row = document.querySelector(`[data-cy="cfg-row-${target}"]`);
                    element = row?.querySelector('textarea, input') || row?.querySelector(`[data-cy="cfg-reorder-${target}"]`) || null;
                }
                element = element || document.querySelector('[data-cy="cfg-add-property"] button');
                // After the focus move, so that the field is announced first.
                window.setTimeout(() => announce(t('editor.aria.deleted', {name})), 0);
                return element;
            }
        });
    };

    // Keys that cannot be saved, once a save was refused (see useOsgiConfigs): each faulty key field
    // says what is wrong with it, and a duplicate names the other entries that use it.
    const keyProblems = useMemo(() => (showKeyProblems ? findKeyProblems(entries) : {}), [showKeyProblems, entries]);
    const keyProblemMessage = index => {
        const problem = keyProblems[index];
        if (problem === 'empty') {
            return t('editor.validation.emptyKeyField');
        }
        if (problem === 'duplicate') {
            const normalized = String(entries[index].key?.value ?? entries[index].key ?? '').trim().toLowerCase();
            const positions = Object.keys(keyProblems)
                .map(Number)
                .filter(other => other !== index && keyProblems[other] === 'duplicate'
                    && String(entries[other].key?.value ?? entries[other].key ?? '').trim().toLowerCase() === normalized)
                .map(other => other + 1)
                .join(', ');
            return t('editor.validation.duplicateKeyField', {positions});
        }
        return '';
    };

    // A refused save brings the first faulty key into view and gives it the focus, clearing a filter
    // that hides any of them.
    useEffect(() => {
        if (!keyProblemsFocusRequest) {
            return;
        }
        const faulty = Object.keys(findKeyProblems(entries)).map(Number).sort((a, b) => a - b);
        if (faulty.length === 0) {
            return;
        }
        const focusFirst = () => {
            const element = inputRefs.current[faulty[0]]?.key;
            if (element && element.isConnected) {
                element.focus();
                element.scrollIntoView?.({block: 'center', behavior: scrollBehavior()});
            }
        };
        if (filtering && faulty.some(index => !matchesCfgFilter(entries[index], filter, isSecretKey))) {
            setFilter('');
            window.requestAnimationFrame(() => window.requestAnimationFrame(focusFirst));
        } else {
            focusFirst();
        }
        // Only on a new request: typing in a key must not take the focus back.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyProblemsFocusRequest]);

    const showRequiredLegend = shownIndices.some(index => {
        const entry = entries[index];
        return (entry.type?.value ?? entry.type) === 'property' && isRequiredWithoutDefault(propertyMap.get(entry.key?.value ?? entry.key));
    });

    // Said in the table when no row is shown, rather than an empty grid.
    let emptyTableMessage = null;
    if (shownIndices.length === 0) {
        if (!Array.isArray(entries) || entries.length === 0) {
            emptyTableMessage = t('editor.tableEmpty.noEntries');
        } else if (filtering) {
            emptyTableMessage = t('editor.tableEmpty.noMatch');
        } else {
            emptyTableMessage = t('editor.tableEmpty.allHidden', {
                comments: t('editor.button.toggleComments'),
                emptyLines: t('editor.button.toggleEmptyLines')
            });
        }
    }

    return (
        // minHeight 0, not overflow hidden: the table scrolls in its own box, and a hidden overflow
        // here cut the focus rings of the filter and of the footer buttons at the edges.
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0 }}>
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
            {showRequiredLegend && (
                <Typography variant="caption" data-cy="cfg-required-legend" style={{color: 'var(--color-gray_dark)'}}>
                    {t('editor.required.legend')}
                </Typography>
            )}

            {/* The revealed-secret overlay closes when the focus moves: it could cover the next row's
                field (WCAG 2.4.11). */}
            <div style={{ flex: 1, overflow: 'auto' }} onScroll={() => setOverlay(null)} onFocusCapture={() => setOverlay(null)}>
                {/* osgi-cfg-table: index.jsx lets its cells overflow, so that focus rings are not cut. */}
                <Table className="osgi-cfg-table" aria-label={t('editor.aria.table')} style={{ width: '100%', minWidth: CFG_TABLE_MIN_WIDTH }}>
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
                            const isSelected = selectedShown === index;
                            const keyProblem = keyProblemMessage(index);
                            const keyErrorId = `cfg-key-error-${index}`;
                            const propertyDefinition = type === 'property' ? propertyMap.get(key) : undefined;
                            const valueHint = valueHintFor(propertyDefinition, t);
                            const valueHintId = `cfg-value-hint-${index}`;
                            const valueRequired = isRequiredWithoutDefault(propertyDefinition);

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
                                    aria-current={isSelected ? 'true' : undefined}
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
                                        data-selected={isSelected ? 'true' : undefined}
                                        // The selected row has a bar as well as its tint, so that the selection is
                                        // not shown by colour alone (WCAG 1.4.1); a border, kept in forced colours.
                                        style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.drag, cursor: filtering ? 'default' : 'grab', borderLeft: `3px solid ${isSelected ? 'var(--color-accent_dark_contrast)' : 'transparent'}` }}
                                        onMouseDown={() => { if (!filtering) setDragArmedIndex(index); }}
                                        onTouchStart={() => { if (!filtering) setDragArmedIndex(index); }}
                                    >
                                        {/* A real button, so the handle is reachable by keyboard: dragging a row
                                            was previously the only way to reorder, which excludes keyboard and
                                            assistive-technology users. Arrow Up/Down call the same handleReorder
                                            the drop handler uses. stopPropagation keeps a click on the handle from
                                            selecting the row. */}
                                        <WithTooltip label={t('editor.reorderHandle')}>
                                        <button
                                            type="button"
                                            data-cy={`cfg-reorder-${index}`}
                                            className="osgi-cfg-icon-button"
                                            aria-label={t('editor.aria.reorder', {name})}
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
                                        </WithTooltip>
                                    </TableBodyCell>

                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.type }}>
                                        {/* Decorative: the row's field is named as a comment. */}
                                        {type === 'comment' && <Comments size="small" aria-hidden="true" focusable="false" style={{ color: cfgCommentColor }} />}
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
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
                                                    <AutoResizeTextArea
                                                        inputRef={el => setInputRef(index, 'key', el)}
                                                        data-cy={`cfg-key-${index}`}
                                                        aria-label={t('editor.aria.key', {position: index + 1})}
                                                        aria-invalid={keyProblem ? 'true' : undefined}
                                                        aria-describedby={keyProblem ? keyErrorId : undefined}
                                                        value={key}
                                                        onChange={e => onUpdate(index, 'key', e.target.value)}
                                                        onFocus={() => handleInputFocus(index)}
                                                        preventNewlines={true}
                                                        placeholder={t('editor.placeholder.key')}
                                                        style={keyProblem ? {...cfgTextInputStyle, border: `2px solid ${cfgErrorColor}`} : cfgTextInputStyle}
                                                    />
                                                    {propertyMap.get(key) && (
                                                        <Tooltip label={<CfgMetatypeInfoTooltip property={propertyMap.get(key)} />}>
                                                            {/* A button, so Tab reaches it and the tooltip opens on focus: the
                                                                property's documentation was mouse-only (WCAG 2.1.1). */}
                                                            <button
                                                                type="button"
                                                                data-cy={`cfg-metatype-info-${index}`}
                                                                className="osgi-cfg-icon-button"
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
                                                {keyProblem && (
                                                    <Typography id={keyErrorId} data-cy={`cfg-key-error-${index}`} variant="caption" style={{color: cfgErrorColor}}>
                                                        {keyProblem}
                                                    </Typography>
                                                )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell data-cy={`cfg-value-cell-${index}`} style={{ ...cfgRowBaseCellStyle, ...CFG_COLUMN_WIDTHS.value }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', width: '100%', position: 'relative' }}
                                                    onMouseEnter={(e) => (isMasked && isSecretVisible) ? handleMouseEnter(e, value) : null}
                                                    onMouseLeave={() => setOverlay(null)}
                                                >
                                                    {/* The mark sits by the value it is about, which carries aria-required. */}
                                                    {valueRequired && (
                                                        <span aria-hidden="true" data-cy={`cfg-required-${index}`} style={{color: cfgErrorColor, fontWeight: 700, lineHeight: '32px', flexShrink: 0}}>*</span>
                                                    )}
                                                    {isMasked ? (
                                                        <div
                                                            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            draggable={false}
                                                            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        >
                                                            {/* A native input like the other fields: Moonstone's Input drew its own
                                                                bordered box around this bordered field, a field inside a field. */}
                                                            <input
                                                                ref={el => setInputRef(index, 'value', el)}
                                                                className="osgi-cfg-field"
                                                                data-cy={`cfg-value-${index}`}
                                                                value={value}
                                                                onChange={e => onUpdate(index, 'value', e.target.value)}
                                                                onFocus={() => handleInputFocus(index)}
                                                                placeholder={t('editor.placeholder.value')}
                                                                aria-label={t('editor.aria.value', {name})}
                                                                aria-required={valueRequired ? 'true' : undefined}
                                                                aria-describedby={valueHint ? valueHintId : undefined}
                                                                // Keeps the browser from filling in the admin's saved password.
                                                                autoComplete="new-password"
                                                                spellCheck={false}
                                                                type={!isSecretVisible ? 'password' : 'text'}
                                                                style={{ ...cfgTextInputStyle, font: 'inherit', lineHeight: '1.5', boxSizing: 'border-box', flex: '1 1 auto', minWidth: 0, width: 'auto' }}
                                                            />
                                                            {/* 24px, centred on the field: at 16px it sat high and overlapped
                                                                the field's target (WCAG 2.5.8). */}
                                                            <WithTooltip label={isSecretVisible ? t('tooltip.hideSecret') : t('tooltip.showSecret')}>
                                                                <Button
                                                                    variant="ghost"
                                                                    icon={isSecretVisible ? <Hidden /> : <Visibility />}
                                                                    onClick={(e) => { e.stopPropagation(); toggleSecret(index); }}
                                                                    aria-label={isSecretVisible ? t('editor.aria.hideSecret', {name}) : t('editor.aria.showSecret', {name})}
                                                                />
                                                            </WithTooltip>
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
                                                            aria-required={valueRequired ? 'true' : undefined}
                                                            aria-describedby={valueHint ? valueHintId : undefined}
                                                            style={cfgTextInputStyle}
                                                        />
                                                    )}

                                                </div>
                                                {valueHint && (
                                                    <Typography id={valueHintId} data-cy={`cfg-value-hint-${index}`} variant="caption" style={{color: 'var(--color-gray_dark)'}}>
                                                        {valueHint}
                                                    </Typography>
                                                )}
                                                </div>
                                            </TableBodyCell>

                                            <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.security }}>
                                                <WithTooltip label={t('editor.encryptValueOf', {key: key || `#${index + 1}`})}>
                                                    <Checkbox
                                                        data-cy={`cfg-encrypted-${index}`}
                                                        // A title on the cell did not name the input (WCAG 4.1.2).
                                                        aria-label={t('editor.encryptValueOf', {key: key || `#${index + 1}`})}
                                                        checked={isEncrypted || false}
                                                        onChange={() => {
                                                            // Sync toggle: Just flip the flag
                                                            // handleToggleEncryption passed from parent handles the flag logic
                                                            handleToggleEncryption([index, 'value'], isEncrypted, value);
                                                        }}
                                                    />
                                                </WithTooltip>
                                            </TableBodyCell>
                                        </>
                                    )}

                                    <TableBodyCell style={{ ...cfgRowIconCellStyle, ...CFG_COLUMN_WIDTHS.actions, gap: '2px' }}>
                                        {/* Move up / down in one click: dragging was the only way with a pointer
                                            (WCAG 2.5.7). Out of the Tab order, where the handle's arrow keys
                                            already do it, so a row does not cost two more Tab stops. Default size,
                                            24px: at 16px the three targets overlapped (WCAG 2.5.8). A flex row, as each
                                            tooltip wraps its button in a block. */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <WithTooltip label={t('editor.aria.moveUp', {name})}>
                                            <Button
                                                data-cy={`cfg-move-up-${index}`}
                                                icon={<ChevronUp />}
                                                variant="ghost"
                                                tabIndex={-1}
                                                isDisabled={!canMoveUp}
                                                aria-label={t('editor.aria.moveUp', {name})}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveEntry(index, -1, 'cfg-reorder');
                                                }}
                                            />
                                        </WithTooltip>
                                        <WithTooltip label={t('editor.aria.moveDown', {name})}>
                                            <Button
                                                data-cy={`cfg-move-down-${index}`}
                                                icon={<ChevronDown />}
                                                variant="ghost"
                                                tabIndex={-1}
                                                isDisabled={!canMoveDown}
                                                aria-label={t('editor.aria.moveDown', {name})}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveEntry(index, 1, 'cfg-reorder');
                                                }}
                                            />
                                        </WithTooltip>
                                        <WithTooltip label={t('editor.aria.delete', {name})}>
                                            <Button
                                                data-cy={`cfg-delete-${index}`}
                                                // A trash can: the X also closes the dialogs (WCAG 3.2.4).
                                                icon={<Delete />}
                                                variant="ghost"
                                                color="danger"
                                                aria-label={t('editor.aria.delete', {name})}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    requestDelete(index);
                                                }}
                                            />
                                        </WithTooltip>
                                        </div>
                                    </TableBodyCell>
                                </TableRow>
                            );
                        })}
                        {emptyTableMessage && (
                            <TableRow tabIndex={undefined} data-cy="cfg-table-empty">
                                {/* headers="": a screen reader otherwise reads the six column headers first. */}
                                <TableBodyCell colSpan={6} headers="" style={{...cfgRowBaseCellStyle, justifyContent: 'center', padding: '16px'}}>
                                    <Typography variant="body" style={{color: 'var(--color-gray_dark)', whiteSpace: 'normal'}}>
                                        {emptyTableMessage}
                                    </Typography>
                                </TableBodyCell>
                            </TableRow>
                        )}
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
                insertDescriptionId={insertDescriptionId}
            />
            {/* hidden, not visually hidden: read through aria-describedby only, not as stray text. */}
            <span id={insertDescriptionId} hidden>{insertDescription}</span>
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
