import React, {useId} from 'react';
import {Tooltip} from '@jahia/moonstone';

// Moonstone's Tooltip clones its child with aria-describedby="moonstone-tooltip_label": an id
// shared by every tooltip, present only while one is open, and which replaces the child's own
// description (Save's blocked reason). Tooltip clones this component instead, which ignores that
// prop, so the control keeps its own aria-describedby.
const KeepOwnDescription = ({control, descriptionId}) => (descriptionId
    ? React.cloneElement(control, {
        'aria-describedby': [control.props['aria-describedby'], descriptionId].filter(Boolean).join(' ')
    })
    : control);

/**
 * Moonstone's black tooltip around a control, opened on hover and on keyboard focus.
 *
 * By default it is visual only: its text must already be the control's accessible name or visible
 * label. With `describe`, the text is also the control's description, through an element of this
 * instance that exists whether or not the tooltip is open (a keyboard shortcut, a disabled reason).
 */
export const WithTooltip = ({label, describe = false, children, ...wrapperProps}) => {
    const descriptionId = useId();
    if (!label) {
        // Moonstone renders nothing at all, not even the child, when its label is empty.
        return children;
    }
    return (
        <>
            <Tooltip label={label} {...wrapperProps}>
                <KeepOwnDescription control={children} descriptionId={describe ? descriptionId : undefined}/>
            </Tooltip>
            {describe && <span hidden id={descriptionId}>{label}</span>}
        </>
    );
};
