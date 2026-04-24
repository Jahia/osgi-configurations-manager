import React from 'react';
import {Build, Chip, Edit, Module, Tooltip} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';

const STATE_STYLES = {
    MODULE: {
        color: 'warning',
        icon: Build,
        labelKey: 'configState.badge.module',
        tooltipKey: 'configState.tooltip.module'
    },
    MODULE_DEFAULT: {
        color: 'accent',
        icon: Module,
        labelKey: 'configState.badge.moduleDefault',
        tooltipKey: 'configState.tooltip.moduleDefault'
    },
    USER: {
        color: 'default',
        icon: Edit,
        labelKey: 'configState.badge.user',
        tooltipKey: 'configState.tooltip.user'
    }
};

const renderChip = (state, config, label) => (
    <Chip
        data-cy={`config-state-badge-${state.toLowerCase()}`}
        color={config.color}
        icon={<config.icon/>}
        label={label}
        style={{flexShrink: 0}}
    />
);

export const ConfigStateBadge = ({state, compact = false, showTooltip = true}) => {
    const {t} = useTranslation('osgi-configurations-manager');
    const effectiveState = STATE_STYLES[state] ? state : 'USER';
    const config = STATE_STYLES[effectiveState];
    const label = compact ? '' : t(config.labelKey);
    const chip = renderChip(effectiveState, config, label);

    if (!showTooltip) {
        return chip;
    }

    return (
        <Tooltip label={t(config.tooltipKey)}>
            {chip}
        </Tooltip>
    );
};
