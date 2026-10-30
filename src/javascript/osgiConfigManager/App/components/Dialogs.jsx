import React from 'react';
import {
    Typography,
    Button,
    Input,
    Close,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Tab,
    TabItem
} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';

const BODY_STACK_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-large)'
};

const SECTION_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-small)'
};

const LIST_STYLE = {
    maxHeight: '320px',
    overflow: 'auto',
    border: '1px solid var(--color-gray_light40)',
    borderRadius: 'var(--border-radius-default)',
    background: 'var(--color-gray_light98)',
    display: 'flex',
    flexDirection: 'column'
};

const FACTORY_LIST_STYLE = {
    ...LIST_STYLE,
    maxHeight: '220px'
};

const INSTANCES_LIST_STYLE = {
    maxHeight: '140px',
    overflow: 'auto',
    border: '1px solid var(--color-gray_light40)',
    borderRadius: 'var(--border-radius-default)',
    background: 'var(--color-gray_light98)'
};

const FACTORY_DETAILS_STYLE = {
    border: '1px solid var(--color-gray_light40)',
    borderRadius: 'var(--border-radius-default)',
    padding: 'var(--spacing-medium)',
    background: 'var(--color-white)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-medium)'
};

const CLOSE_BUTTON_STYLE = {
    position: 'absolute',
    top: 'var(--spacing-medium)',
    right: 'var(--spacing-medium)',
    zIndex: 1
};

const EMPTY_LIST_ITEM_STYLE = {
    padding: 'var(--spacing-medium)'
};

const getSelectableCardStyle = isSelected => ({
    padding: 'var(--spacing-medium)',
    borderBottom: '1px solid var(--color-gray_light40)',
    background: isSelected ? 'var(--color-accent_light80)' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-small)'
});

const OPTION_TEXT_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
};

const EXISTING_INSTANCE_STYLE = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-gray_light40)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
};

// A native radio, not a clickable div: the options were unreachable by keyboard and their
// selection was conveyed by a background colour only (WCAG 2.1.1, 4.1.2). The label keeps
// the whole card clickable; the texts are spans because a label only holds phrasing content.
const CreateOptionCard = ({dataCy, name, value, isSelected, onSelect, title, subtitle, meta, description}) => (
    <label data-cy={dataCy} style={getSelectableCardStyle(isSelected)}>
        <input
            type="radio"
            name={name}
            value={value}
            checked={isSelected}
            onChange={onSelect}
        />
        <span style={OPTION_TEXT_STYLE}>
            <Typography component="span" variant="body" weight="bold" style={{wordBreak: 'break-word'}}>
                {title}
            </Typography>
            {subtitle && (
                <Typography component="span" variant="caption" color="textSecondary" style={{wordBreak: 'break-word'}}>
                    {subtitle}
                </Typography>
            )}
            {meta && (
                <Typography component="span" variant="caption" color="textSecondary">
                    {meta}
                </Typography>
            )}
            {description && (
                // gray_dark is opaque (12.9:1); the 20/40/60 variants are alpha and fail 4.5:1.
                <Typography component="span" variant="caption" style={{color: 'var(--color-gray_dark)'}}>
                    {description}
                </Typography>
            )}
        </span>
    </label>
);

export const ModalDialog = ({config, onClose}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const [promptValue, setPromptValue] = React.useState(config?.defaultValue || '');
    const [manualFilename, setManualFilename] = React.useState('');
    const [filterValue, setFilterValue] = React.useState('');
    const [selectedPid, setSelectedPid] = React.useState('');
    const [selectedFactoryPid, setSelectedFactoryPid] = React.useState('');
    const [factoryIdentifier, setFactoryIdentifier] = React.useState('');
    const [activeCreateTab, setActiveCreateTab] = React.useState('manual');
    const metatypeGroupLabelId = React.useId();
    const titleId = React.useId();
    const messageId = React.useId();
    const manualInputId = React.useId();
    const filterInputId = React.useId();
    const factoryIdentifierId = React.useId();
    const factoryIdentifierErrorId = React.useId();
    const factoryGroupLabelId = React.useId();

    React.useEffect(() => {
        setPromptValue(config?.defaultValue || '');
        setManualFilename('');
        setFilterValue('');
        setSelectedPid('');
        setSelectedFactoryPid('');
        setFactoryIdentifier('');
        setActiveCreateTab('manual');
    }, [config]);

    const filteredMetatypes = React.useMemo(() => {
        if (!Array.isArray(config?.availableMetatypes)) {
            return [];
        }

        const search = filterValue.trim().toLowerCase();
        if (!search) {
            return config.availableMetatypes;
        }

        return config.availableMetatypes.filter(definition => {
            const haystack = [
                definition.name,
                definition.pid,
                definition.description,
                definition.bundleName,
                definition.bundleSymbolicName
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(search);
        });
    }, [config?.availableMetatypes, filterValue]);

    const availableMetatypes = React.useMemo(() => (
        filteredMetatypes.filter(definition => !definition.factory && !definition.created)
    ), [filteredMetatypes]);

    const availableFactoryMetatypes = React.useMemo(() => (
        filteredMetatypes.filter(definition => definition.factory)
    ), [filteredMetatypes]);

    const selectedMetatype = React.useMemo(() => {
        if (!selectedPid || !Array.isArray(config?.availableMetatypes)) {
            return null;
        }

        return config.availableMetatypes.find(definition => definition.pid === selectedPid) || null;
    }, [config?.availableMetatypes, selectedPid]);

    const selectedFactoryMetatype = React.useMemo(() => {
        if (!selectedFactoryPid || !Array.isArray(config?.availableMetatypes)) {
            return null;
        }

        return config.availableMetatypes.find(definition => definition.pid === selectedFactoryPid && definition.factory) || null;
    }, [config?.availableMetatypes, selectedFactoryPid]);

    const factorySuggestedFilename = React.useMemo(() => {
        if (!selectedFactoryMetatype) {
            return '';
        }

        const trimmedIdentifier = factoryIdentifier.trim();
        if (!trimmedIdentifier) {
            return selectedFactoryMetatype.filename || '';
        }

        return `${selectedFactoryMetatype.pid}-${trimmedIdentifier}.cfg`;
    }, [factoryIdentifier, selectedFactoryMetatype]);

    const isFactoryIdentifierTaken = React.useMemo(() => {
        if (!selectedFactoryMetatype || !factoryIdentifier.trim()) {
            return false;
        }

        const expectedFilename = `${selectedFactoryMetatype.pid}-${factoryIdentifier.trim()}.cfg`.toLowerCase();
        return (selectedFactoryMetatype.instances || []).some(instance => instance.filename?.toLowerCase() === expectedFilename);
    }, [factoryIdentifier, selectedFactoryMetatype]);

    const createTabs = React.useMemo(() => ([
        {id: 'manual', label: t('modal.create.tabs.manual')},
        {id: 'configuration', label: t('modal.create.tabs.configuration')},
        {id: 'factory', label: t('modal.create.tabs.factory')}
    ]), [t]);

    if (!config) {
        return null;
    }

    const isCreateConfig = config.type === 'createConfig';
    const isWarning = config.type === 'warning' || (config.type === 'confirm' && config.severity === 'warning');
    const hasPromptInput = config.type === 'prompt';
    const showModalMessage = Boolean(config.message);

    const isConfirmDisabled = isCreateConfig ? (
        (activeCreateTab === 'manual' && !manualFilename.trim()) ||
        (activeCreateTab === 'configuration' && !selectedMetatype) ||
        (activeCreateTab === 'factory' && (!selectedFactoryMetatype || !factoryIdentifier.trim() || isFactoryIdentifierTaken))
    ) : false;

    const handleConfirm = () => {
        let confirmPayload;

        if (config.type === 'prompt') {
            confirmPayload = promptValue;
        } else if (config.type === 'createConfig') {
            if (activeCreateTab === 'configuration' && selectedMetatype) {
                confirmPayload = {
                    mode: 'metatype',
                    pid: selectedMetatype.pid
                };
            } else if (activeCreateTab === 'factory' && selectedFactoryMetatype && factoryIdentifier.trim()) {
                confirmPayload = {
                    mode: 'factory',
                    pid: selectedFactoryMetatype.pid,
                    instanceIdentifier: factoryIdentifier.trim()
                };
            } else if (activeCreateTab === 'manual') {
                confirmPayload = {
                    mode: 'manual',
                    filename: manualFilename.trim()
                };
            }
        }

        onClose();

        if (!config.onConfirm) {
            return;
        }

        if (config.deferConfirm === false) {
            config.onConfirm(confirmPayload);
            return;
        }

        window.setTimeout(() => {
            config.onConfirm(confirmPayload);
        }, 0);
    };

    return (
        <Modal
            data-cy="modal-dialog"
            // Moonstone points aria-labelledby at the dialog itself, which named it with its whole
            // content (every option of the Create list included): name it by its title, and
            // describe it by its message (WCAG 4.1.2).
            aria-labelledby={titleId}
            aria-describedby={showModalMessage ? messageId : undefined}
            isOpen
            size={isCreateConfig ? 'large' : 'medium'}
            onOpenChange={isOpen => {
                if (!isOpen) {
                    onClose();
                }
            }}
        >
            <>
                <div style={{position: 'relative'}}>
                    <div style={CLOSE_BUTTON_STYLE}>
                        <Button
                            aria-label={t('modal.cancel')}
                            icon={<Close/>}
                            size="small"
                            variant="ghost"
                            onClick={onClose}
                        />
                    </div>
                    <ModalHeader title={<span id={titleId}>{config.title}</span>}>
                        {showModalMessage ? <span id={messageId}>{config.message}</span> : null}
                    </ModalHeader>
                </div>

                <ModalBody>
                    <div style={BODY_STACK_STYLE}>
                        {hasPromptInput && (
                            <Input
                                data-cy="modal-prompt-input"
                                // The question is the dialog's message (or title): the placeholder
                                // "Type here..." was the field's only name (WCAG 4.1.2).
                                aria-labelledby={showModalMessage ? messageId : titleId}
                                autoFocus
                                value={promptValue}
                                variant="outlined"
                                onChange={event => setPromptValue(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                        handleConfirm();
                                    }
                                }}
                                placeholder={t('modal.prompt.placeholder')}
                            />
                        )}

                        {isCreateConfig && (
                            <>
                                <div style={SECTION_STYLE}>
                                    <Tab>
                                        {createTabs.map(tab => (
                                            <TabItem
                                                key={tab.id}
                                                data-cy={`modal-create-tab-${tab.id}`}
                                                isSelected={activeCreateTab === tab.id}
                                                label={tab.label}
                                                onClick={() => setActiveCreateTab(tab.id)}
                                            />
                                        ))}
                                    </Tab>
                                </div>

                                {activeCreateTab === 'manual' && (
                                    <div style={SECTION_STYLE}>
                                        <Typography component="label" htmlFor={manualInputId} variant="subheading" weight="bold">
                                            {t('modal.create.manualLabel')}
                                        </Typography>
                                        <Input
                                            data-cy="modal-create-manual-input"
                                            id={manualInputId}
                                            autoFocus
                                            value={manualFilename}
                                            variant="outlined"
                                            onChange={event => setManualFilename(event.target.value)}
                                            placeholder={t('modal.create.manualPlaceholder')}
                                        />
                                    </div>
                                )}

                                {(activeCreateTab === 'configuration' || activeCreateTab === 'factory') && (
                                    <div style={SECTION_STYLE}>
                                        <Typography component="label" htmlFor={filterInputId} variant="subheading" weight="bold">
                                            {t('modal.create.filterLabel')}
                                        </Typography>
                                        <Input
                                            data-cy="modal-create-filter-input"
                                            id={filterInputId}
                                            value={filterValue}
                                            variant="outlined"
                                            onChange={event => setFilterValue(event.target.value)}
                                            placeholder={t('modal.create.filterPlaceholder')}
                                        />
                                    </div>
                                )}

                                {/* role="radiogroup", not <fieldset>: Jahia's administration stylesheet gives every
                                    fieldset an !important padding and border that inline styles cannot undo. */}
                                {activeCreateTab === 'configuration' && (
                                    <div role="radiogroup" aria-labelledby={metatypeGroupLabelId} style={SECTION_STYLE}>
                                        <Typography id={metatypeGroupLabelId} variant="subheading" weight="bold">
                                            {t('modal.create.templateLabel')}
                                        </Typography>

                                        <div style={LIST_STYLE}>
                                            {availableMetatypes.length === 0 && (
                                                <div style={EMPTY_LIST_ITEM_STYLE}>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {t('modal.create.emptyMetatypes')}
                                                    </Typography>
                                                </div>
                                            )}

                                            {availableMetatypes.map(definition => (
                                                <CreateOptionCard
                                                    key={definition.pid}
                                                    dataCy={`modal-create-metatype-option-${encodeURIComponent(definition.pid)}`}
                                                    name="osgi-create-metatype"
                                                    value={definition.pid}
                                                    description={definition.description}
                                                    isSelected={selectedPid === definition.pid}
                                                    meta={definition.bundleName ? `${t('modal.create.bundle')}: ${definition.bundleName}` : null}
                                                    subtitle={definition.pid}
                                                    title={definition.name || definition.pid}
                                                    onSelect={() => {
                                                        setSelectedPid(definition.pid);
                                                        setManualFilename('');
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {selectedMetatype && (
                                            <Typography variant="caption" color="textSecondary">
                                                {t('modal.create.suggestedFilename')}: {selectedMetatype.filename}
                                            </Typography>
                                        )}
                                    </div>
                                )}

                                {activeCreateTab === 'factory' && (
                                    <div role="radiogroup" aria-labelledby={factoryGroupLabelId} style={SECTION_STYLE}>
                                        <Typography id={factoryGroupLabelId} variant="subheading" weight="bold">
                                            {t('modal.create.factoryLabel')}
                                        </Typography>

                                        <div style={FACTORY_LIST_STYLE}>
                                            {availableFactoryMetatypes.length === 0 && (
                                                <div style={EMPTY_LIST_ITEM_STYLE}>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {t('modal.create.emptyFactories')}
                                                    </Typography>
                                                </div>
                                            )}

                                            {availableFactoryMetatypes.map(definition => (
                                                <CreateOptionCard
                                                    key={`factory-${definition.pid}`}
                                                    dataCy={`modal-create-factory-option-${encodeURIComponent(definition.pid)}`}
                                                    name="osgi-create-factory"
                                                    value={definition.pid}
                                                    description={definition.description}
                                                    isSelected={selectedFactoryPid === definition.pid}
                                                    meta={definition.bundleName ? `${t('modal.create.bundle')}: ${definition.bundleName}` : t('modal.create.instanceCount', {count: definition.instanceCount || 0})}
                                                    subtitle={definition.pid}
                                                    title={definition.name || definition.pid}
                                                    onSelect={() => {
                                                        setSelectedFactoryPid(definition.pid);
                                                        setManualFilename('');
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {selectedFactoryMetatype && (
                                            <div style={FACTORY_DETAILS_STYLE}>
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('modal.create.factoryPattern')}: {selectedFactoryMetatype.filename}
                                                </Typography>

                                                <div style={SECTION_STYLE}>
                                                    <Typography component="label" htmlFor={factoryIdentifierId} variant="body" weight="bold">
                                                        {t('modal.create.factoryIdentifierLabel')}
                                                    </Typography>
                                                    <Input
                                                        data-cy="modal-create-factory-identifier-input"
                                                        id={factoryIdentifierId}
                                                        aria-invalid={isFactoryIdentifierTaken || undefined}
                                                        aria-describedby={isFactoryIdentifierTaken ? factoryIdentifierErrorId : undefined}
                                                        autoFocus
                                                        value={factoryIdentifier}
                                                        variant="outlined"
                                                        onChange={event => setFactoryIdentifier(event.target.value)}
                                                        placeholder={t('modal.create.factoryIdentifierPlaceholder')}
                                                    />
                                                    {factorySuggestedFilename && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {t('modal.create.suggestedFilename')}: {factorySuggestedFilename}
                                                        </Typography>
                                                    )}
                                                    {/* Announced and tied to the field; danger_dark, as danger was
                                                        3.68:1 (WCAG 1.4.3, 3.3.1, 4.1.3). */}
                                                    <div role="alert">
                                                        {isFactoryIdentifierTaken && (
                                                            <Typography id={factoryIdentifierErrorId} variant="caption" style={{color: 'var(--color-danger_dark)'}}>
                                                                {t('modal.create.factoryIdentifierExists')}
                                                            </Typography>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={SECTION_STYLE}>
                                                    <Typography variant="body" weight="bold">
                                                        {t('modal.create.existingInstances')}
                                                    </Typography>
                                                    {(selectedFactoryMetatype.instances || []).length === 0 && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {t('modal.create.emptyInstances')}
                                                        </Typography>
                                                    )}
                                                    {(selectedFactoryMetatype.instances || []).length > 0 && (
                                                        <div style={INSTANCES_LIST_STYLE}>
                                                            {(selectedFactoryMetatype.instances || []).map(instance => (
                                                                <div
                                                                    key={instance.filename}
                                                                    data-cy={`modal-create-existing-instance-${encodeURIComponent(instance.filename)}`}
                                                                    style={EXISTING_INSTANCE_STYLE}
                                                                >
                                                                    <Typography variant="body" weight="bold" style={{wordBreak: 'break-word'}}>
                                                                        {instance.identifier}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="textSecondary" style={{wordBreak: 'break-word'}}>
                                                                        {instance.filename}
                                                                    </Typography>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    {config.cancelLabel !== null && (
                        <div data-cy="modal-cancel-button">
                            <Button
                                color={config.confirmLabel === null ? 'accent' : 'default'}
                                label={config.cancelLabel || t('modal.cancel')}
                                size="big"
                                variant={config.confirmLabel === null ? 'default' : 'ghost'}
                                onClick={onClose}
                            />
                        </div>
                    )}
                    {config.confirmLabel !== null && (
                        <div data-cy="modal-confirm-button">
                            <Button
                                color={isWarning ? 'danger' : 'accent'}
                                isDisabled={isConfirmDisabled}
                                label={config.confirmLabel || t('modal.ok')}
                                size="big"
                                onClick={handleConfirm}
                            />
                        </div>
                    )}
                </ModalFooter>
            </>
        </Modal>
    );
};
