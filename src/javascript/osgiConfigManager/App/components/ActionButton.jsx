import React from 'react';
import {Button, Tooltip} from '@jahia/moonstone';

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
            {tooltip ? (
                <Tooltip label={tooltip}>
                    {button}
                </Tooltip>
            ) : button}
        </div>
    );
};
