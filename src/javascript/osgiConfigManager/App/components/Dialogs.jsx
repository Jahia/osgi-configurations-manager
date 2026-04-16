import React from 'react';
import {
    Typography,
    Button,
    Input,
    Paper,
    Close
} from '@jahia/moonstone';
import { useTranslation } from 'react-i18next';

export const ModalDialog = ({ config, onClose }) => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [promptValue, setPromptValue] = React.useState(config?.defaultValue || '');
    const [manualFilename, setManualFilename] = React.useState('');
    const [filterValue, setFilterValue] = React.useState('');
    const [selectedPid, setSelectedPid] = React.useState('');
    const [selectedFactoryPid, setSelectedFactoryPid] = React.useState('');
    const [factoryIdentifier, setFactoryIdentifier] = React.useState('');
    const [activeCreateTab, setActiveCreateTab] = React.useState('manual');

    // Reset value when config changes
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

    if (!config) return null;

    const handleConfirm = () => {
        if (config.type === 'prompt') {
            config.onConfirm(promptValue);
        } else if (config.type === 'createConfig') {
            if (activeCreateTab === 'configuration' && selectedMetatype) {
                config.onConfirm({
                    mode: 'metatype',
                    pid: selectedMetatype.pid
                });
            } else if (activeCreateTab === 'factory' && selectedFactoryMetatype && factoryIdentifier.trim()) {
                config.onConfirm({
                    mode: 'factory',
                    pid: selectedFactoryMetatype.pid,
                    instanceIdentifier: factoryIdentifier.trim()
                });
            } else if (activeCreateTab === 'manual') {
                config.onConfirm({
                    mode: 'manual',
                    filename: manualFilename.trim()
                });
            }
        } else {
            if (config.onConfirm) config.onConfirm();
        }
        onClose();
    };

    const isCreateConfig = config.type === 'createConfig';
    const isWarning = config.type === 'warning' || (config.type === 'confirm' && config.severity === 'warning');
    const accentColor = isWarning ? '#db3d44' : '#00a0e3'; // Jahia Blue / Warning Red
    const isConfirmDisabled = isCreateConfig ? (
        (activeCreateTab === 'manual' && !manualFilename.trim()) ||
        (activeCreateTab === 'configuration' && !selectedMetatype) ||
        (activeCreateTab === 'factory' && (!selectedFactoryMetatype || !factoryIdentifier.trim() || isFactoryIdentifierTaken))
    ) : false;

    const createTabs = [
        {id: 'manual', label: t('modal.create.tabs.manual')},
        {id: 'configuration', label: t('modal.create.tabs.configuration')},
        {id: 'factory', label: t('modal.create.tabs.factory')}
    ];

    return (
        <div
            data-cy="modal-dialog"
            style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(20, 25, 30, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s ease'
        }}
            onClick={onClose}
        >
            <Paper
                style={{
                    width: config.type === 'createConfig' ? '720px' : '520px',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#fff',
                    animation: 'modalSlideIn 0.3s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 28px',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Typography variant="heading" weight="bold" style={{ fontSize: '18px', color: '#111' }}>
                        {config.title}
                    </Typography>
                    <div style={{ cursor: 'pointer', color: '#888', transition: 'color 0.2s' }}
                        onClick={onClose}
                        onMouseOver={e => e.currentTarget.style.color = '#333'}
                        onMouseOut={e => e.currentTarget.style.color = '#888'}>
                        <Close />
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <Typography style={{ fontSize: '16px', color: '#444', lineHeight: '1.6' }}>
                        {config.message}
                    </Typography>

                    {config.type === 'prompt' && (
                        <div style={{ marginTop: '8px' }}>
                            <Input
                                data-cy="modal-prompt-input"
                                autoFocus
                                value={promptValue}
                                variant="outlined"
                                style={{
                                    width: '100%',
                                    fontSize: '16px',
                                    padding: '8px 12px'
                                    // Removed manual border to avoid double border with Moonstone's outlined variant
                                }}
                                onChange={(e) => setPromptValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirm();
                                }}
                                placeholder={t('modal.prompt.placeholder')}
                            />
                        </div>
                    )}

                    {isCreateConfig && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                borderBottom: '1px solid #ececec',
                                paddingBottom: '8px'
                            }}>
                                {createTabs.map(tab => {
                                    const isActive = activeCreateTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            data-cy={`modal-create-tab-${tab.id}`}
                                            type="button"
                                            onClick={() => setActiveCreateTab(tab.id)}
                                            style={{
                                                border: 'none',
                                                background: isActive ? '#eef8fd' : 'transparent',
                                                color: isActive ? '#0077b6' : '#555',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: isActive ? 700 : 500,
                                                fontSize: '14px'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {activeCreateTab === 'manual' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Typography variant="subheading" weight="bold">
                                        {t('modal.create.manualLabel')}
                                    </Typography>
                                    <Input
                                        data-cy="modal-create-manual-input"
                                        autoFocus
                                        value={manualFilename}
                                        variant="outlined"
                                        onChange={(e) => setManualFilename(e.target.value)}
                                        placeholder={t('modal.create.manualPlaceholder')}
                                    />
                                </div>
                            )}

                            {(activeCreateTab === 'configuration' || activeCreateTab === 'factory') && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Typography variant="subheading" weight="bold">
                                        {t('modal.create.filterLabel')}
                                    </Typography>
                                    <Input
                                        data-cy="modal-create-filter-input"
                                        value={filterValue}
                                        variant="outlined"
                                        onChange={e => setFilterValue(e.target.value)}
                                        placeholder={t('modal.create.filterPlaceholder')}
                                    />
                                </div>
                            )}

                            {activeCreateTab === 'configuration' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Typography variant="subheading" weight="bold">
                                        {t('modal.create.templateLabel')}
                                    </Typography>

                                    <div style={{
                                        maxHeight: '320px',
                                        overflow: 'auto',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '6px',
                                        background: '#fafafa',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        {availableMetatypes.length === 0 && (
                                            <div style={{ padding: '14px 16px' }}>
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('modal.create.emptyMetatypes')}
                                                </Typography>
                                            </div>
                                        )}

                                        {availableMetatypes.map(definition => {
                                            const isSelected = selectedPid === definition.pid;
                                            return (
                                                <div
                                                    key={definition.pid}
                                                    data-cy={`modal-create-metatype-option-${encodeURIComponent(definition.pid)}`}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderBottom: '1px solid #ececec',
                                                        background: isSelected ? '#eef8fd' : 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px'
                                                    }}
                                                    onClick={() => {
                                                        setSelectedPid(definition.pid);
                                                        setManualFilename('');
                                                    }}
                                                >
                                                    <Typography variant="body" weight="bold" style={{ wordBreak: 'break-word' }}>
                                                        {definition.name || definition.pid}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary" style={{ wordBreak: 'break-word' }}>
                                                        {definition.pid}
                                                    </Typography>
                                                    {definition.bundleName && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {t('modal.create.bundle')}: {definition.bundleName}
                                                        </Typography>
                                                    )}
                                                    {definition.description && (
                                                        <Typography variant="caption" style={{ color: '#555' }}>
                                                            {definition.description}
                                                        </Typography>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {selectedMetatype && (
                                        <Typography variant="caption" color="textSecondary">
                                            {t('modal.create.suggestedFilename')}: {selectedMetatype.filename}
                                        </Typography>
                                    )}
                                </div>
                            )}

                            {activeCreateTab === 'factory' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Typography variant="subheading" weight="bold">
                                        {t('modal.create.factoryLabel')}
                                    </Typography>

                                    <div style={{
                                        maxHeight: '220px',
                                        overflow: 'auto',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '6px',
                                        background: '#fafafa',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        {availableFactoryMetatypes.length === 0 && (
                                            <div style={{ padding: '14px 16px' }}>
                                                <Typography variant="caption" color="textSecondary">
                                                    {t('modal.create.emptyFactories')}
                                                </Typography>
                                            </div>
                                        )}

                                        {availableFactoryMetatypes.map(definition => {
                                            const isSelected = selectedFactoryPid === definition.pid;
                                            return (
                                                <div
                                                    key={`factory-${definition.pid}`}
                                                    data-cy={`modal-create-factory-option-${encodeURIComponent(definition.pid)}`}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderBottom: '1px solid #ececec',
                                                        background: isSelected ? '#eef8fd' : 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px'
                                                    }}
                                                    onClick={() => {
                                                        setSelectedFactoryPid(definition.pid);
                                                        setManualFilename('');
                                                    }}
                                                >
                                                    <Typography variant="body" weight="bold" style={{ wordBreak: 'break-word' }}>
                                                        {definition.name || definition.pid}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary" style={{ wordBreak: 'break-word' }}>
                                                        {definition.pid}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {t('modal.create.instanceCount', { count: definition.instanceCount || 0 })}
                                                    </Typography>
                                                    {definition.bundleName && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {t('modal.create.bundle')}: {definition.bundleName}
                                                        </Typography>
                                                    )}
                                                    {definition.description && (
                                                        <Typography variant="caption" style={{ color: '#555' }}>
                                                            {definition.description}
                                                        </Typography>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {selectedFactoryMetatype && (
                                        <div style={{
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '6px',
                                            padding: '14px 16px',
                                            background: '#fff',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <Typography variant="caption" color="textSecondary">
                                                {t('modal.create.factoryPattern')}: {selectedFactoryMetatype.filename}
                                            </Typography>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <Typography variant="body" weight="bold">
                                                    {t('modal.create.factoryIdentifierLabel')}
                                                </Typography>
                                                <Input
                                                    data-cy="modal-create-factory-identifier-input"
                                                    autoFocus
                                                    value={factoryIdentifier}
                                                    variant="outlined"
                                                    onChange={e => setFactoryIdentifier(e.target.value)}
                                                    placeholder={t('modal.create.factoryIdentifierPlaceholder')}
                                                />
                                                {factorySuggestedFilename && (
                                                    <Typography variant="caption" color="textSecondary">
                                                        {t('modal.create.suggestedFilename')}: {factorySuggestedFilename}
                                                    </Typography>
                                                )}
                                                {isFactoryIdentifierTaken && (
                                                    <Typography variant="caption" style={{ color: '#db3d44' }}>
                                                        {t('modal.create.factoryIdentifierExists')}
                                                    </Typography>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <Typography variant="body" weight="bold">
                                                    {t('modal.create.existingInstances')}
                                                </Typography>
                                                {(selectedFactoryMetatype.instances || []).length === 0 && (
                                                    <Typography variant="caption" color="textSecondary">
                                                        {t('modal.create.emptyInstances')}
                                                    </Typography>
                                                )}
                                                {(selectedFactoryMetatype.instances || []).length > 0 && (
                                                    <div style={{
                                                        maxHeight: '140px',
                                                        overflow: 'auto',
                                                        border: '1px solid #ececec',
                                                        borderRadius: '6px',
                                                        background: '#fafafa'
                                                    }}>
                                                        {(selectedFactoryMetatype.instances || []).map(instance => (
                                                            <div
                                                                key={instance.filename}
                                                                data-cy={`modal-create-existing-instance-${encodeURIComponent(instance.filename)}`}
                                                                style={{
                                                                    padding: '10px 12px',
                                                                    borderBottom: '1px solid #ececec',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '2px'
                                                                }}
                                                            >
                                                                <Typography variant="body" weight="bold" style={{ wordBreak: 'break-word' }}>
                                                                    {instance.identifier}
                                                                </Typography>
                                                                <Typography variant="caption" color="textSecondary" style={{ wordBreak: 'break-word' }}>
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
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 28px',
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '14px',
                    background: '#fafafa'
                }}>
                    {config.cancelLabel !== null && (
                        <div data-cy="modal-cancel-button">
                            <Button
                                label={config.cancelLabel || t('modal.cancel')}
                                variant="ghost"
                                onClick={onClose}
                            />
                        </div>
                    )}
                    {config.otherLabel && (
                        <div data-cy="modal-other-button">
                            <Button
                                label={config.otherLabel}
                                variant="outlined"
                                onClick={() => {
                                    if (config.onOther) config.onOther();
                                    onClose();
                                }}
                            />
                        </div>
                    )}
                    {config.confirmLabel !== null && (
                        <div data-cy="modal-confirm-button">
                            <Button
                                label={config.confirmLabel || t('modal.ok')}
                                style={{
                                    backgroundColor: accentColor,
                                    color: '#fff',
                                    minWidth: '100px',
                                    fontWeight: '600'
                                }}
                                disabled={isConfirmDisabled}
                                onClick={handleConfirm}
                            />
                        </div>
                    )}
                </div>
            </Paper>

            <style>{`
                @keyframes modalSlideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
