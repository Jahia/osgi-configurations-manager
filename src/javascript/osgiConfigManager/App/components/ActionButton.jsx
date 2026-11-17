import React from 'react';
import {Button} from '@jahia/moonstone';
import {WithTooltip} from './WithTooltip';

export const ActionButton = ({
    dataCy,
    tooltip,
    describeTooltip = false,
    variant = 'ghost',
    size = 'default',
    ...buttonProps
}) => {
    const button = (
        <Button
            size={size}
            variant={variant}
            {...buttonProps}
        />
    );

    return (
        <div data-cy={dataCy}>
            {/* WithTooltip, not Moonstone's Tooltip directly, which replaced the button's own
                description (Save's blocked reason) with its label. describeTooltip makes the
                tooltip the button's description too, for a reason the label does not give. */}
            <WithTooltip label={tooltip} describe={describeTooltip}>
                {button}
            </WithTooltip>
        </div>
    );
};
