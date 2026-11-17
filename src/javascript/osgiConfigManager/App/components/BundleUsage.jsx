import React, {useEffect, useId, useState} from 'react';
import {Typography} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {osgiService} from '../api/osgiService';
import {CHROME_TOKENS} from './AppChrome';

const KIND_KEYS = {
    BOUND: 'bundleUsage.kind.bound',
    COMPONENT: 'bundleUsage.kind.component',
    MANAGED_SERVICE: 'bundleUsage.kind.managedService',
    MANAGED_SERVICE_FACTORY: 'bundleUsage.kind.managedServiceFactory',
    METATYPE: 'bundleUsage.kind.metatype'
};

const STATE_KEYS = {
    ACTIVE: 'bundleUsage.state.active',
    SATISFIED: 'bundleUsage.state.satisfied',
    UNSATISFIED_REFERENCE: 'bundleUsage.state.unsatisfiedReference',
    UNSATISFIED_CONFIGURATION: 'bundleUsage.state.unsatisfiedConfiguration',
    FAILED_ACTIVATION: 'bundleUsage.state.failedActivation',
    DISABLED: 'bundleUsage.state.disabled'
};

// CHROME_TOKENS.subtleTextColor is gray_dark at 60% on main, 3.82:1 on white (WCAG 1.4.3). This is
// the opaque 7:1 value PR #190 gives that token; use the token again once it is merged. A browser
// without color-mix drops the declaration and the text inherits the dark colour.
const SECONDARY_TEXT_COLOR = 'color-mix(in srgb, var(--color-gray_dark) 80%, var(--color-white))';
// Long symbolic names and versions wrap rather than clip (WCAG 1.4.10).
const TEXT_STYLE = {color: SECONDARY_TEXT_COLOR, overflowWrap: 'anywhere'};
const LIST_STYLE = {margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px'};

const describeUsage = (t, usage) => {
    const kind = t(KIND_KEYS[usage.kind] || 'bundleUsage.kind.other');
    if (usage.kind !== 'COMPONENT') {
        return kind;
    }
    const states = (usage.states || []).map(state => t(STATE_KEYS[state] || 'bundleUsage.state.unknown')).join(', ');
    return states
        ? t('bundleUsage.componentWithStates', {kind, name: usage.detail, states})
        : t('bundleUsage.componentNamed', {kind, name: usage.detail});
};

/**
 * Which bundles use the open configuration, with their version and how they use it. Read-only.
 * Loaded once the file itself has loaded, so it follows a reload (Refresh, or after a save).
 */
export const BundleUsage = ({fileName, isLoadingFile = false}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const labelId = useId();
    // Idle at mount, so that the status region exists, empty, before its first text: a live
    // region mounted together with its text is not announced reliably (WCAG 4.1.3).
    const [state, setState] = useState({status: 'idle', bundles: []});

    useEffect(() => {
        if (!fileName) {
            return undefined;
        }
        setState({status: 'loading', bundles: []});
        if (isLoadingFile) {
            return undefined;
        }
        let current = true;
        osgiService.getBundleUsage(fileName)
            .then(bundles => current && setState({status: 'loaded', bundles}))
            .catch(() => current && setState({status: 'error', bundles: []}));
        return () => {
            current = false;
        };
    }, [fileName, isLoadingFile]);

    const {status, bundles} = state;
    let message = null;
    if (status === 'loading') {
        message = t('bundleUsage.loading');
    } else if (status === 'error') {
        message = t('bundleUsage.error');
    } else if (status === 'loaded' && bundles.length === 0) {
        message = t('bundleUsage.empty');
    }

    return (
        <div data-cy="bundle-usage" role="group" aria-labelledby={labelId} style={{marginTop: '8px', minWidth: 0}}>
            <Typography id={labelId} variant="caption" weight="bold" style={{color: CHROME_TOKENS.strongTextColor}}>
                {t('bundleUsage.title')}
            </Typography>
            {/* Always mounted, so that the outcome is announced when it arrives; a div, as
                Moonstone's Typography renders nothing while empty. */}
            <div data-cy="bundle-usage-status" role="status">
                {message && (
                    <Typography variant="caption" style={TEXT_STYLE}>{message}</Typography>
                )}
            </div>
            {status === 'loaded' && bundles.length > 0 && (
                <ul data-cy="bundle-usage-list" style={LIST_STYLE}>
                    {bundles.map(bundle => (
                        <li key={`${bundle.symbolicName}/${bundle.version}`} data-cy="bundle-usage-item">
                            <Typography variant="caption" style={TEXT_STYLE}>
                                <strong style={{color: CHROME_TOKENS.strongTextColor}}>{bundle.name}</strong>
                                {bundle.name !== bundle.symbolicName && ` (${bundle.symbolicName})`}
                                {' '}{t('bundleUsage.version', {version: bundle.version})}
                                {' — '}{bundle.usages.map(usage => describeUsage(t, usage)).join(', ')}
                            </Typography>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
