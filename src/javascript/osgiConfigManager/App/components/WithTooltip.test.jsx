import React from 'react';
import {render, screen} from '@testing-library/react';
import {WithTooltip} from './WithTooltip';

// Moonstone's Tooltip replaced its child's aria-describedby with its own label's id, so Save,
// described by its blocked reason, lost that reason as soon as it got a tooltip.
describe('WithTooltip', () => {
    it("keeps the control's own description", () => {
        render(
            <>
                <p id="reason">Fix the errors first</p>
                <WithTooltip label="Save changes">
                    <button type="button" aria-describedby="reason">Save</button>
                </WithTooltip>
            </>
        );

        expect(screen.getByRole('button', {name: 'Save'}).getAttribute('aria-describedby')).toBe('reason');
    });

    it('adds its text as a lasting description when asked to', () => {
        render(
            <WithTooltip describe label="Ctrl+M toggles it too">
                <button type="button">Tab leaves the editor</button>
            </WithTooltip>
        );

        expect(screen.getByRole('button', {name: 'Tab leaves the editor'})).toHaveAccessibleDescription('Ctrl+M toggles it too');
    });

    it('renders the control alone without a label', () => {
        render(<WithTooltip label=""><button type="button">Plain</button></WithTooltip>);

        expect(screen.getByRole('button', {name: 'Plain'})).toBeInTheDocument();
    });
});
