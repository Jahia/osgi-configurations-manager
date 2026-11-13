import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {FileSidebar} from './FileSidebar';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: key => key})
}));

const FILES = [
    {name: 'org.example.alpha.cfg', path: '/etc/org.example.alpha.cfg', enabled: true, configState: 'USER'},
    {name: 'org.example.beta.cfg.disabled', path: '/etc/org.example.beta.cfg.disabled', enabled: false, configState: 'MODULE'},
    {name: 'org.example.gamma.yml', path: '/etc/org.example.gamma.yml', enabled: true, configState: 'USER'}
];

const renderSidebar = (props = {}) => render(
    <FileSidebar
        files={FILES}
        selectedFile={null}
        handleFileClick={jest.fn()}
        searchTerm=""
        setSearchTerm={jest.fn()}
        searchInContent={false}
        setSearchInContent={jest.fn()}
        {...props}
    />
);

// The list was a table whose every row was a Tab stop that Enter did not open, with the open file
// and the disabled ones shown only by colour.
describe('FileSidebar file list', () => {
    beforeAll(() => {
        // jsdom has no layout: the sidebar scrolls the open file into view.
        Element.prototype.scrollIntoView = jest.fn();
    });

    it('is a named listbox with a single Tab stop', () => {
        renderSidebar();

        const list = screen.getByRole('listbox', {name: 'app.fileList'});
        expect(list.getAttribute('tabindex')).toBe('0');
        const options = within(list).getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options.every(option => !option.hasAttribute('tabindex'))).toBe(true);
    });

    it('exposes the open file as the selected, active option', () => {
        renderSidebar({selectedFile: FILES[2]});

        const list = screen.getByRole('listbox');
        const selected = within(list).getByRole('option', {selected: true});
        expect(selected.textContent).toContain('org.example.gamma.yml');
        expect(list.getAttribute('aria-activedescendant')).toBe(selected.id);
    });

    it('moves the selection with the arrow keys, Home and End', () => {
        const handleFileClick = jest.fn();
        // Sorted by extension, then name: alpha.cfg, beta.cfg.disabled, gamma.yml.
        renderSidebar({selectedFile: FILES[0], handleFileClick});
        const list = screen.getByRole('listbox');

        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'End'});
        fireEvent.keyDown(list, {key: 'Home'});

        expect(handleFileClick.mock.calls.map(([file]) => file.name)).toEqual([
            'org.example.beta.cfg.disabled',
            'org.example.gamma.yml',
            'org.example.alpha.cfg'
        ]);
    });

    it('says in text which files are disabled and where each one comes from', () => {
        renderSidebar();

        const [alpha, beta] = screen.getAllByRole('option');
        expect(beta.textContent).toContain('app.fileDisabled');
        expect(beta.textContent).toContain('configState.badge.module');
        expect(alpha.textContent).not.toContain('app.fileDisabled');
        expect(alpha.textContent).toContain('configState.badge.user');
    });

    it('names the filter field and the content search switch', () => {
        renderSidebar();

        expect(screen.getByRole('checkbox', {name: 'app.searchDeep'})).toBeInTheDocument();
        expect(screen.getByLabelText('app.searchLabel').tagName).toBe('INPUT');
    });
});
