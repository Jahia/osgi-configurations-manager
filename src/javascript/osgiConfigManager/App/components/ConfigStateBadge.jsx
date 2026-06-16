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

const renderChip = (state, config, label, ariaLabel) => (
    <Chip
        // Moonstone renders Chip as a bare <div> (implicit ARIA role "generic"), and the generic
        // role PROHIBITS aria-label/aria-describedby. role="img" models the badge as a single
        // iconographic graphic whose accessible name is the config state, which permits both the
        // aria-label below and the aria-describedby injected by the Tooltip wrapper.
        role="img"
        data-cy={`config-state-badge-${state.toLowerCase()}`}
        aria-label={ariaLabel}
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
    const fullLabel = t(config.labelKey);
    // Always expose the full state as the accessible name, even in compact (icon-only) mode.
    const chip = renderChip(effectiveState, config, compact ? '' : fullLabel, fullLabel);

    if (!showTooltip) {
        return chip;
    }

    return (
        <Tooltip label={t(config.tooltipKey)}>
            {chip}
        </Tooltip>
    );
};
