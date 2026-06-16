import React from 'react';
import { createPortal } from 'react-dom';
import { Button, Close, Input, Paper, Typography } from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../hooks/useDialogA11y';
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
    const [query, setQuery] = React.useState('');
    const containerRef = useDialogA11y(open, onClose);

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
            ref={containerRef}
            tabIndex={-1}
            data-cy="cfg-metatype-property-dialog"
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
                role="dialog"
                aria-modal="true"
                aria-label={t('editor.metatype.cfgPicker.title')}
                onClick={event => event.stopPropagation()}
                style={{
                    width: '760px',
                    maxWidth: 'calc(100vw - 40px)',
                    maxHeight: 'calc(100vh - 60px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
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
                        <Typography variant="heading" weight="bold">{t('editor.metatype.cfgPicker.title')}</Typography>
                        <Typography variant="body" style={{ color: '#666' }}>{t('editor.metatype.cfgPicker.description')}</Typography>
                    </div>
                    <Button
                        variant="ghost"
                        size="small"
                        icon={<Close />}
                        onClick={onClose}
                        aria-label={t('modal.cancel')}
                    />
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
                    <Input
                        data-cy="cfg-metatype-property-search"
                        autoFocus
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && trimmedQuery) {
                                if (exactMatch) {
                                    onSelectMetatypeProperty(exactMatch);
                                } else if (!customAlreadyExists) {
                                    onCreateCustomProperty(trimmedQuery);
                                }
                                onClose();
                            }
                        }}
                        placeholder={t('editor.metatype.cfgPicker.searchPlaceholder')}
                        variant="outlined"
                    />

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
                                <div
                                    key={property.id}
                                    data-cy={`cfg-metatype-property-option-${encodeURIComponent(property.id)}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={property.id}
                                    onClick={() => {
                                        onSelectMetatypeProperty(property);
                                        onClose();
                                    }}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onSelectMetatypeProperty(property);
                                            onClose();
                                        }
                                    }}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #ececec',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
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
                                </div>
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
                        {trimmedQuery && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {customAlreadyExists && (
                                    <Typography variant="caption" style={{ color: '#db3d44' }}>
                                        {t('editor.metatype.cfgPicker.customAlreadyExists')}
                                    </Typography>
                                )}
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
