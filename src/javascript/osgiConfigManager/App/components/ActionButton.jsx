import React from 'react';
import {Button} from '@jahia/moonstone';
import {WithTooltip} from './WithTooltip';

export const ActionButton = ({
    dataCy,
    tooltip,
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
                description (Save's blocked reason) with its label. */}
            <WithTooltip label={tooltip}>
                {button}
            </WithTooltip>
        </div>
    );
};
