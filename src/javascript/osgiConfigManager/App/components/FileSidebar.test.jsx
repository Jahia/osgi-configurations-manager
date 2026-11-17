import React from 'react';
import {render, screen, fireEvent, within, act} from '@testing-library/react';
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

        expect(screen.getByRole('region', {name: 'app.fileList'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {level: 2, name: 'app.fileList'})).toBeInTheDocument();
        const list = screen.getByRole('listbox', {name: 'app.fileList'});
        expect(list).toHaveAccessibleDescription('app.fileListHint');
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

    // Opens each file it reaches, as the list always did, so that a user can page through them.
    it('opens the file the arrow keys, Home and End reach', () => {
        const opened = [];
        const Harness = () => {
            const [selected, setSelected] = React.useState(FILES[0]);
            return (
                <FileSidebar
                    files={FILES}
                    selectedFile={selected}
                    handleFileClick={file => {
                        opened.push(file.name);
                        setSelected(file);
                    }}
                    searchTerm=""
                    setSearchTerm={jest.fn()}
                    searchInContent={false}
                    setSearchInContent={jest.fn()}
                />
            );
        };
        // Sorted by extension, then name: alpha.cfg, beta.cfg.disabled, gamma.yml.
        render(<Harness/>);
        const list = screen.getByRole('listbox');
        const options = screen.getAllByRole('option');

        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'End'});
        // Already open: not opened again.
        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'Home'});

        expect(opened).toEqual(['org.example.beta.cfg.disabled', 'org.example.gamma.yml', 'org.example.alpha.cfg']);
        expect(list.getAttribute('aria-activedescendant')).toBe(options[0].id);
        expect(options.map(option => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    });

    // The ring is on the first file before any is open: the keys go on from where it shows.
    it('moves on from the first file when none is open', () => {
        const handleFileClick = jest.fn();
        renderSidebar({handleFileClick});
        const list = screen.getByRole('listbox');

        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'Home'});

        expect(handleFileClick.mock.calls.map(([file]) => file.name)).toEqual(['org.example.beta.cfg.disabled', 'org.example.alpha.cfg']);
    });

    // With unsaved changes, each arrow press asked to discard them.
    it('only moves the active option while changes are unsaved, and opens it on Enter or Space', () => {
        const handleFileClick = jest.fn();
        renderSidebar({selectedFile: FILES[0], handleFileClick, hasUnsaved: true});
        const list = screen.getByRole('listbox');
        const options = screen.getAllByRole('option');
        const active = () => list.getAttribute('aria-activedescendant');

        fireEvent.keyDown(list, {key: 'ArrowDown'});
        expect(active()).toBe(options[1].id);
        fireEvent.keyDown(list, {key: 'End'});
        expect(active()).toBe(options[2].id);
        fireEvent.keyDown(list, {key: 'Home'});
        expect(active()).toBe(options[0].id);
        expect(handleFileClick).not.toHaveBeenCalled();
        // The open file stays the selected one, stated on every option.
        expect(options.map(option => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);

        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'Enter'});
        // A held key repeats: the dialog, closed by the first press, would open again.
        fireEvent.keyDown(list, {key: 'Enter', repeat: true});
        fireEvent.keyDown(list, {key: 'End'});
        fireEvent.keyDown(list, {key: ' '});

        expect(handleFileClick.mock.calls.map(([file]) => file.name)).toEqual([
            'org.example.beta.cfg.disabled',
            'org.example.gamma.yml'
        ]);
    });

    it('goes on from the open file once the changes are saved or cancelled', () => {
        const handleFileClick = jest.fn();
        const props = {files: FILES, selectedFile: FILES[0], handleFileClick, searchTerm: '', setSearchTerm: jest.fn(), searchInContent: false, setSearchInContent: jest.fn()};
        const {rerender} = render(<FileSidebar {...props} hasUnsaved/>);
        const list = screen.getByRole('listbox');
        fireEvent.keyDown(list, {key: 'End'});

        rerender(<FileSidebar {...props} hasUnsaved={false}/>);
        expect(list.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
        fireEvent.keyDown(list, {key: 'ArrowDown'});
        expect(handleFileClick.mock.calls.map(([file]) => file.name)).toEqual(['org.example.beta.cfg.disabled']);
    });

    // The preview of a cut name lives under body: a press on it took the focus out of the list, and
    // the arrow keys did nothing after it.
    it('keeps the focus in the list when the preview of a cut name is clicked', () => {
        const scrollWidth = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
        const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
        try {
            const handleFileClick = jest.fn();
            renderSidebar({selectedFile: FILES[0], handleFileClick});
            const list = screen.getByRole('listbox');
            fireEvent.mouseEnter(document.querySelector('[data-cy="sidebar-file-name-org.example.gamma.yml"]'));
            const preview = document.querySelector('[data-cy="floating-text-preview"]');
            expect(preview).not.toBeNull();

            expect(fireEvent.mouseDown(preview)).toBe(false);
            fireEvent.click(preview);

            expect(handleFileClick.mock.calls.map(([file]) => file.name)).toEqual(['org.example.gamma.yml']);
            expect(document.activeElement).toBe(list);
        } finally {
            scrollWidth.mockRestore();
            clientWidth.mockRestore();
        }
    });

    it('rings the active row only while the keyboard drives the list', () => {
        renderSidebar({selectedFile: FILES[0]});
        const list = screen.getByRole('listbox');
        const options = screen.getAllByRole('option');

        expect(options.some(option => option.hasAttribute('data-active'))).toBe(false);
        fireEvent.keyDown(list, {key: 'ArrowDown'});
        expect(options[1].getAttribute('data-active')).toBe('true');
        fireEvent.pointerDown(list);
        expect(options[1].hasAttribute('data-active')).toBe(false);
    });

    it('falls back to the open file, then the first, when the filter hides the active option', () => {
        const {rerender} = renderSidebar({selectedFile: FILES[0]});
        const list = screen.getByRole('listbox');
        fireEvent.keyDown(list, {key: 'End'});

        const props = {files: FILES, selectedFile: FILES[0], handleFileClick: jest.fn(), setSearchTerm: jest.fn(), searchInContent: false, setSearchInContent: jest.fn()};
        rerender(<FileSidebar {...props} searchTerm="beta"/>);
        expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option').id);

        rerender(<FileSidebar {...props} searchTerm="nothing"/>);
        expect(list.hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('marks the open file with unsaved changes, in text', () => {
        renderSidebar({selectedFile: FILES[0], hasUnsaved: true});

        const [alpha, beta] = screen.getAllByRole('option');
        expect(alpha.textContent).toContain('app.fileUnsaved');
        expect(beta.textContent).not.toContain('app.fileUnsaved');
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

describe('FileSidebar filter count', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const props = {files: FILES, selectedFile: null, handleFileClick: jest.fn(), setSearchTerm: jest.fn(), searchInContent: false, setSearchInContent: jest.fn()};

    it('announces the number of matching files once the filter settles, not at the first load', () => {
        const {rerender} = render(<FileSidebar {...props} searchTerm=""/>);
        const status = screen.getByRole('status');
        act(() => jest.advanceTimersByTime(1000));
        expect(status.textContent).toBe('');

        rerender(<FileSidebar {...props} searchTerm="example.a"/>);
        act(() => jest.advanceTimersByTime(399));
        expect(status.textContent).toBe('');
        act(() => jest.advanceTimersByTime(1));
        expect(status.textContent).toBe('app.fileCount');

        rerender(<FileSidebar {...props} searchTerm="nothing"/>);
        act(() => jest.advanceTimersByTime(400));
        expect(status.textContent).toBe('app.noFileMatches');
        expect(screen.getByText('app.noFileMatches', {selector: '[data-cy="file-list-no-match"]'})).toBeInTheDocument();
    });

    it('waits for the results of a deep search', () => {
        const {rerender} = render(<FileSidebar {...props} searchTerm="x"/>);
        const status = screen.getByRole('status');

        rerender(<FileSidebar {...props} searchTerm="x" searchInContent loadingFiles/>);
        act(() => jest.advanceTimersByTime(2000));
        expect(status.textContent).toBe('');

        rerender(<FileSidebar {...props} files={[FILES[0]]} searchTerm="x" searchInContent loadingFiles={false}/>);
        act(() => jest.advanceTimersByTime(700));
        expect(status.textContent).toBe('app.fileCount');
    });
});
