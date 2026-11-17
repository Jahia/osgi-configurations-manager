import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {SelectedFileToolbar} from './SelectedFileToolbar';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

const renderToolbar = (props = {}) => render(
    <SelectedFileToolbar
        selectedFile={{name: 'org.example.cfg', enabled: true}}
        canMarkAsDefault={false}
        isRawMode={false}
        onToggleFile={jest.fn()}
        onMarkAsDefault={jest.fn()}
        onDownloadFile={jest.fn()}
        onDeleteFile={jest.fn()}
        onSetEditorMode={jest.fn()}
        {...props}
    />
);

// The mode was a Moonstone Dropdown whose menu the keyboard could open but not use.
describe('SelectedFileToolbar editor mode', () => {
    it('offers the two modes as pressed/unpressed buttons in a named group', () => {
        renderToolbar();

        expect(screen.getByRole('group', {name: 'editor.modeLabel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'editor.button.modeVisual'}).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', {name: 'editor.button.modeRaw'}).getAttribute('aria-pressed')).toBe('false');
    });

    it('switches to the other mode only', () => {
        const onSetEditorMode = jest.fn();
        renderToolbar({onSetEditorMode});

        fireEvent.click(screen.getByRole('button', {name: 'editor.button.modeVisual'}));
        fireEvent.click(screen.getByRole('button', {name: 'editor.button.modeRaw'}));

        expect(onSetEditorMode.mock.calls).toEqual([['raw']]);
    });

    it('refuses the switch while the file loads', () => {
        renderToolbar({isLoadingFile: true});

        expect(screen.getByRole('button', {name: 'editor.button.modeRaw'})).toBeDisabled();
    });
});

// Mark as Default used the disabled attribute: out of the Tab order, with no reason given.
describe('SelectedFileToolbar Mark as Default', () => {
    it('stays focusable when unavailable, says why, and does nothing', () => {
        const onMarkAsDefault = jest.fn();
        renderToolbar({canMarkAsDefault: false, configState: 'MODULE_DEFAULT', onMarkAsDefault});

        const button = screen.getByRole('button', {name: 'app.markAsDefault'});
        expect(button).not.toBeDisabled();
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button).toHaveAccessibleDescription('tooltip.markAsDefaultAlready');
        fireEvent.click(button);
        expect(onMarkAsDefault).not.toHaveBeenCalled();
    });

    it('gives the module reason for a module-managed file', () => {
        renderToolbar({canMarkAsDefault: false, configState: 'MODULE'});

        expect(screen.getByRole('button', {name: 'app.markAsDefault'})).toHaveAccessibleDescription('tooltip.markAsDefaultModule');
    });

    it('marks a local file', () => {
        const onMarkAsDefault = jest.fn();
        renderToolbar({canMarkAsDefault: true, onMarkAsDefault});

        const button = screen.getByRole('button', {name: 'app.markAsDefault'});
        expect(button.hasAttribute('aria-disabled')).toBe(false);
        fireEvent.click(button);
        expect(onMarkAsDefault).toHaveBeenCalledTimes(1);
    });
});
