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
