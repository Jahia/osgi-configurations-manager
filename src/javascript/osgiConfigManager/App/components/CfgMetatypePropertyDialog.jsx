import React from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { createPortal } from 'react-dom';
import { Button, Close, Input, Paper, Typography } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { buildPropertyDocumentation, findExactMetatypePropertyMatch, formatDefaultValue, getLocalizedTypeLabel, getPropertyLabel, matchesMetatypePropertyQuery } from '../utils/metatypeUtils';

const renderDocumentation = (property, t) => {
    const description = buildPropertyDocumentation(property, t, {includeHeader: false})
        .replace(/\*\*/g, '')
        .replace(/`/g, '');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Typography variant="body" weight="bold" style={{ color: '#fff' }}>
                {getPropertyLabel(property)}
            </Typography>
            <Typography variant="caption" style={{ color: '#d7e2e8', wordBreak: 'break-word' }}>
                {property.id}
            </Typography>
            <Typography variant="caption" style={{ whiteSpace: 'pre-wrap', color: '#f1f5f7' }}>
                {description}
            </Typography>
        </div>
    );
};

export const CfgMetatypePropertyDialog = ({
    open,
    properties,
    existingKeys,
    onClose,
    onSelectMetatypeProperty,
    onCreateCustomProperty
}) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const titleId = React.useId();
    const descriptionId = React.useId();
    const existsId = React.useId();

    // Focus into the dialog, trap Tab, close on Escape, restore focus on unmount.
    const dialogRef = useDialogA11y(open, onClose);
    const [query, setQuery] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setQuery('');
        }
    }, [open]);

    const trimmedQuery = query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const exactMatch = React.useMemo(() => findExactMetatypePropertyMatch(properties, trimmedQuery), [properties, trimmedQuery]);

    const filteredProperties = React.useMemo(() => {
        if (!Array.isArray(properties)) {
            return [];
        }

        if (!normalizedQuery) {
            return properties;
        }

        return properties.filter(property => matchesMetatypePropertyQuery(property, normalizedQuery));
    }, [normalizedQuery, properties]);

    const customAlreadyExists = Boolean(trimmedQuery) && existingKeys.has(trimmedQuery);
    const knownMetatypeProperty = Boolean(trimmedQuery) && properties.some(property => property.id === trimmedQuery);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            data-cy="cfg-metatype-property-dialog"
            // On the dialog element itself: the Paper of the Moonstone version Jahia serves does not
            // forward its ref, so the hook found no container, and Tab was blocked behind the dialog.
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(20, 25, 30, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000
            }}
        >
            <Paper
                onClick={event => event.stopPropagation()}
                style={{
                    width: '760px',
                    maxWidth: 'calc(100vw - 40px)',
                    maxHeight: 'calc(100vh - 60px)',
                    display: 'flex',
                    flexDirection: 'column',
                    // auto, not hidden: at 400% zoom the custom-property section was cut off (1.4.10).
                    overflow: 'auto',
                    padding: 0
                }}
            >
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #ececec',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Typography id={titleId} component="h2" variant="heading" weight="bold" style={{ margin: 0 }}>{t('editor.metatype.cfgPicker.title')}</Typography>
                        <Typography id={descriptionId} variant="body" style={{ color: '#595959' }}>{t('editor.metatype.cfgPicker.description')}</Typography>
                    </div>
                    {/* A button: the clickable icon could not be reached by Tab nor named (WCAG 4.1.2). */}
                    <Button
                        data-cy="cfg-metatype-property-close"
                        variant="ghost"
                        icon={<Close />}
                        aria-label={t('modal.close')}
                        title={t('modal.close')}
                        onClick={onClose}
                    />
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input
                        data-cy="cfg-metatype-property-search"
                        // data-autofocus, not autoFocus: see useDialogA11y (focus given back on close).
                        data-autofocus
                        aria-label={t('editor.metatype.cfgPicker.searchPlaceholder')}
                        aria-describedby={customAlreadyExists ? `${descriptionId} ${existsId}` : descriptionId}
                        aria-invalid={customAlreadyExists || undefined}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && trimmedQuery) {
                                if (exactMatch) {
                                    onSelectMetatypeProperty(exactMatch);
                                } else if (customAlreadyExists) {
                                    // Stay open: closing added nothing and said nothing.
                                    return;
                                } else {
                                    onCreateCustomProperty(trimmedQuery);
                                }
                                onClose();
                            }
                        }}
                        placeholder={t('editor.metatype.cfgPicker.searchPlaceholder')}
                        variant="outlined"
                    />

                    {/* The number of matches, announced as the list filters (WCAG 4.1.3). */}
                    <div role="status" data-cy="cfg-metatype-property-count" style={{ fontSize: '12px', color: 'var(--color-gray_dark)' }}>
                        {t('editor.metatype.cfgPicker.count', { count: filteredProperties.length })}
                    </div>

                    <div style={{
                        border: '1px solid #ececec',
                        borderRadius: '6px',
                        background: '#fafafa',
                        overflow: 'auto',
                        maxHeight: '360px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {filteredProperties.map(property => {
                            const defaultValue = formatDefaultValue(property);
                            return (
                                <button
                                    type="button"
                                    key={property.id}
                                    data-cy={`cfg-metatype-property-option-${encodeURIComponent(property.id)}`}
                                    onClick={() => {
                                        onSelectMetatypeProperty(property);
                                        onClose();
                                    }}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #ececec',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        // reset the button chrome so the row keeps its original look
                                        background: 'none',
                                        border: 'none',
                                        borderRadius: 0,
                                        width: '100%',
                                        textAlign: 'left',
                                        font: 'inherit',
                                        color: 'inherit'
                                    }}
                                >
                                    <Typography variant="body" weight="bold" style={{ wordBreak: 'break-word' }}>
                                        {property.id}
                                    </Typography>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {property.type && (
                                            <Typography variant="caption" color="textSecondary">
                                                {t('editor.metatype.type')}: {getLocalizedTypeLabel(property.type, t)}
                                            </Typography>
                                        )}
                                        {defaultValue && (
                                            <Typography variant="caption" color="textSecondary">
                                                {t('editor.metatype.default')}: {defaultValue}
                                            </Typography>
                                        )}
                                    </div>
                                    {property.description && (
                                        <Typography variant="caption" style={{ color: '#555' }}>
                                            {property.description}
                                        </Typography>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{
                        borderTop: '1px solid #ececec',
                        paddingTop: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <Typography variant="subheading" weight="bold">{t('editor.metatype.cfgPicker.customTitle')}</Typography>
                        {/* Mounted before the message, so it is announced; tied to the field above. */}
                        <div role="status">
                            {trimmedQuery && customAlreadyExists && (
                                <Typography id={existsId} variant="caption" style={{ color: 'var(--color-danger_dark)' }}>
                                    {t('editor.metatype.cfgPicker.customAlreadyExists')}
                                </Typography>
                            )}
                        </div>
                        {trimmedQuery && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {!customAlreadyExists && knownMetatypeProperty && (
                                    <Typography variant="caption" style={{ color: '#0077b6' }}>
                                        {t('editor.metatype.cfgPicker.knownProperty')}
                                    </Typography>
                                )}
                                <Button
                                    data-cy="cfg-metatype-property-custom-create"
                                    label={exactMatch
                                        ? t('editor.metatype.cfgPicker.customAction', { name: exactMatch.id })
                                        : t('editor.metatype.cfgPicker.customAction', { name: trimmedQuery })}
                                    onClick={() => {
                                        if (exactMatch) {
                                            onSelectMetatypeProperty(exactMatch);
                                        } else {
                                            onCreateCustomProperty(trimmedQuery);
                                        }
                                        onClose();
                                    }}
                                    disabled={customAlreadyExists}
                                    variant="outlined"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #ececec',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <Button label={t('modal.cancel')} variant="ghost" onClick={onClose} />
                </div>
            </Paper>
        </div>,
        document.body
    );
};

export const CfgMetatypeInfoTooltip = ({ property }) => {
    const { t } = useTranslation('osgi-configurations-manager');

    if (!property) {
        return null;
    }

    return renderDocumentation(property, t);
};
