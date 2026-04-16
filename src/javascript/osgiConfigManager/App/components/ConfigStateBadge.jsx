import React from 'react';
import {Tooltip, Typography} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';

const STATE_STYLES = {
    MODULE: {
        background: '#fff4e5',
        color: '#9a5b00',
        labelKey: 'configState.badge.module',
        compactLabelKey: 'configState.badgeCompact.module',
        tooltipKey: 'configState.tooltip.module'
    },
    MODULE_DEFAULT: {
        background: '#eef8fd',
        color: '#0077b6',
        labelKey: 'configState.badge.moduleDefault',
        compactLabelKey: 'configState.badgeCompact.moduleDefault',
        tooltipKey: 'configState.tooltip.moduleDefault'
    },
    USER: {
        background: '#f3f4f6',
        color: '#4b5563',
        labelKey: 'configState.badge.user',
        compactLabelKey: 'configState.badgeCompact.user',
        tooltipKey: 'configState.tooltip.user'
    }
};

export const ConfigStateBadge = ({state, compact = false}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const effectiveState = STATE_STYLES[state] ? state : 'USER';
    const config = STATE_STYLES[effectiveState];

    return (
        <Tooltip label={t(config.tooltipKey)}>
            <div
                data-cy={`config-state-badge-${effectiveState.toLowerCase()}`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: compact ? '2px 6px' : '4px 10px',
                    minWidth: compact ? '24px' : undefined,
                    borderRadius: '999px',
                    background: config.background,
                    color: config.color,
                    flexShrink: 0
                }}
            >
                <Typography
                    variant="caption"
                    weight="bold"
                    style={{
                        color: config.color,
                        fontSize: compact ? '11px' : '12px',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap'
                    }}
                >
                    {t(compact ? config.compactLabelKey : config.labelKey)}
                </Typography>
            </div>
        </Tooltip>
    );
};
