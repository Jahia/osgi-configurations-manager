import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {ExportArchiveDialog, ImportArchiveDialog} from './ArchiveDialogs';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (!options) {
                return key;
            }
            const values = Object.entries(options)
                .filter(([name]) => name !== 'interpolation')
                .map(([, value]) => value);
            return values.length ? `${key}:${values.join(':')}` : key;
        }
    })
}));

const FILES = [
    {name: 'org.a.cfg', enabled: true},
    {name: 'org.b.yml', enabled: false},
    {name: 'other.cfg', enabled: true}
];

// Moonstone's Modal focuses its first field on a timer after opening: let it, as a user would.
const settleOpening = async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
    });
};

const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

describe('ExportArchiveDialog', () => {
    const renderExport = async (onExport = jest.fn().mockResolvedValue(undefined)) => {
        render(<ExportArchiveDialog isOpen files={FILES} onClose={jest.fn()} onExport={onExport}/>);
        await settleOpening();
        return onExport;
    };

    it('is a dialog named by its title and described by what the archive holds', async () => {
        await renderExport();
        const dialog = screen.getByRole('dialog', {name: 'archive.export.title'});
        expect(dialog).toHaveAccessibleDescription('archive.export.intro');
    });

    it('names every checkbox by its file and marks a disabled one in words', async () => {
        await renderExport();
        expect(screen.getByRole('checkbox', {name: 'org.a.cfg'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'org.b.yml archive.export.disabledFile'})).toBeInTheDocument();
    });

    it('refuses an empty selection and a short password, says why, and focuses the first problem', async () => {
        const onExport = await renderExport();
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.confirm'}));
        await flush();

        expect(onExport).not.toHaveBeenCalled();
        // The list, named and described by the error: its first checkbox is not.
        const list = screen.getByRole('list', {name: 'archive.export.listLabel'});
        expect(document.activeElement).toBe(list);
        expect(list).toHaveAccessibleDescription('archive.export.errorNoSelection');

        fireEvent.click(screen.getByRole('checkbox', {name: 'org.a.cfg'}));
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.confirm'}));
        await flush();
        const password = screen.getByLabelText('archive.password.label archive.required');
        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveAccessibleDescription('archive.password.hint:12 archive.password.errorTooShort:12');
        expect(document.activeElement).toBe(password);
    });

    it('refuses two different passwords on the confirmation field', async () => {
        const onExport = await renderExport();
        fireEvent.click(screen.getByRole('checkbox', {name: 'org.a.cfg'}));
        fireEvent.change(screen.getByLabelText('archive.password.label archive.required'), {target: {value: 'a-long-password'}});
        fireEvent.change(screen.getByLabelText('archive.password.confirmLabel archive.required'), {target: {value: 'another-password'}});
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.confirm'}));
        await flush();

        expect(onExport).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(screen.getByLabelText('archive.password.confirmLabel archive.required'));
        expect(screen.getByLabelText('archive.password.confirmLabel archive.required')).toHaveAccessibleDescription('archive.password.errorMismatch');
    });

    it('selects the files the filter shows, and exports them in list order with the password', async () => {
        const onExport = await renderExport();
        fireEvent.change(screen.getByLabelText('archive.export.filterLabel'), {target: {value: 'org.'}});
        expect(screen.queryByRole('checkbox', {name: 'other.cfg'})).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.selectShown'}));
        fireEvent.change(screen.getByLabelText('archive.password.label archive.required'), {target: {value: 'a-long-password'}});
        fireEvent.change(screen.getByLabelText('archive.password.confirmLabel archive.required'), {target: {value: 'a-long-password'}});
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.confirm'}));
        await flush();

        expect(onExport).toHaveBeenCalledWith(['org.a.cfg', 'org.b.yml'], 'a-long-password');
    });

    it('shows a server error in an alert and keeps what was typed', async () => {
        await renderExport(jest.fn().mockRejectedValue(new Error('Export denied')));
        fireEvent.click(screen.getByRole('checkbox', {name: 'org.a.cfg'}));
        fireEvent.change(screen.getByLabelText('archive.password.label archive.required'), {target: {value: 'a-long-password'}});
        fireEvent.change(screen.getByLabelText('archive.password.confirmLabel archive.required'), {target: {value: 'a-long-password'}});
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.confirm'}));
        await flush();

        expect(screen.getByText('archive.export.error:Export denied').closest('[role="alert"]')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'org.a.cfg'})).toBeChecked();
    });

    it('announces the count after a pause, and not at opening', async () => {
        jest.useFakeTimers();
        try {
            render(<ExportArchiveDialog isOpen files={FILES} onClose={jest.fn()} onExport={jest.fn()}/>);
            const status = screen.getAllByRole('status')[0];
            act(() => jest.advanceTimersByTime(1000));
            expect(status).toHaveTextContent('', {normalizeWhitespace: true});
            expect(status.textContent).toBe('');
            fireEvent.click(screen.getByRole('checkbox', {name: 'org.a.cfg'}));
            act(() => jest.advanceTimersByTime(400));
            expect(status).toHaveTextContent('archive.export.listCount:3:1:3');
        } finally {
            jest.useRealTimers();
        }
    });
});

const PREVIEW = {
    exportedAt: '2026-11-17T15:00:00Z',
    jahia: {archiveVersion: '8.2.3.2', targetVersion: '8.2.2.3', comparison: 'OLDER'},
    files: [
        {
            name: 'org.a.cfg',
            allowed: true,
            action: 'OVERWRITE',
            sameConfiguration: ['org.a.yml'],
            secrets: 2,
            undecryptable: 1,
            reference: 'USERS',
            bundles: [{
                symbolicName: 'jcontent', name: 'jContent', archiveVersion: '3.7.0', targetVersion: '3.6.2',
                targetActive: true, comparison: 'OLDER', otherVersions: ['3.5.0']
            }],
            unknownKeys: ['new.key'],
            metatypeChecked: true,
            clearSecrets: ['api.token']
        },
        {name: 'org.b.cfg', allowed: true, action: 'CREATE', reference: 'NONE', bundles: [], unknownKeys: [], clearSecrets: []},
        {name: 'org.hidden.cfg', allowed: false, refusal: 'NOT_PERMITTED'}
    ]
};

describe('ImportArchiveDialog', () => {
    const ARCHIVE = {fileName: 'export.ocmx', base64: 'QUJD'};

    const renderImport = async ({onPreview = jest.fn().mockResolvedValue(PREVIEW), onImport = jest.fn()} = {}) => {
        render(<ImportArchiveDialog archive={ARCHIVE} onClose={jest.fn()} onPreview={onPreview} onImport={onImport}/>);
        await settleOpening();
        return {onPreview, onImport};
    };

    const checkWith = async password => {
        fireEvent.change(screen.getByLabelText('archive.password.label archive.required'), {target: {value: password}});
        fireEvent.click(screen.getByRole('button', {name: 'archive.import.check'}));
        await flush();
    };

    it('asks the password first, and shows a wrong one on its field', async () => {
        await renderImport({onPreview: jest.fn().mockRejectedValue(new Error('The password is not correct, or the archive is damaged. Check the password and try again.'))});
        expect(screen.getByRole('dialog', {name: 'archive.import.title'})).toHaveAccessibleDescription('archive.import.intro:export.ocmx');

        await checkWith('wrong-one');
        const password = screen.getByLabelText('archive.password.label archive.required');
        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveAccessibleDescription('The password is not correct, or the archive is damaged. Check the password and try again.');
        expect(document.activeElement).toBe(password);
    });

    it('previews file by file, focuses the summary, and preselects what can be imported', async () => {
        const {onPreview} = await renderImport();
        await checkWith('the-right-password');

        expect(onPreview).toHaveBeenCalledWith('QUJD', 'the-right-password');
        expect(document.activeElement).toHaveAttribute('data-cy', 'archive-import-summary');
        expect(screen.getByText('archive.preview.summaryFiles:3')).toBeInTheDocument();
        expect(screen.getByText('archive.preview.summaryOverwrite:1')).toBeInTheDocument();
        expect(screen.getByText('archive.preview.summaryRefused:1')).toBeInTheDocument();
        expect(screen.getByRole('dialog', {name: 'archive.import.reviewTitle'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'org.a.cfg'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'org.b.cfg'})).toBeChecked();
        expect(screen.queryByRole('checkbox', {name: 'org.hidden.cfg'})).toBeNull();
        expect(screen.getByText('archive.preview.refusedPermission')).toBeInTheDocument();
    });

    it('describes each checkbox by what the import does and what may surprise', async () => {
        await renderImport();
        await checkWith('the-right-password');

        const description = screen.getByRole('checkbox', {name: 'org.a.cfg'}).getAttribute('aria-describedby');
        const notes = document.getElementById(description).textContent;
        expect(notes).toContain('archive.preview.replaces');
        expect(notes).toContain('archive.preview.usedBy jContent (jcontent): archive.preview.versionOlder:3.7.0:3.6.2');
        expect(notes).toContain('archive.preview.otherVersions:3.5.0');
        expect(notes).toContain('archive.preview.unknownKeys:new.key');
        expect(notes).toContain('archive.preview.sameConfiguration:org.a.yml');
        expect(notes).toContain('archive.preview.secrets:2');
        expect(notes).toContain('archive.preview.undecryptable:1');
        expect(notes).toContain('archive.preview.clearSecrets:api.token');
    });

    it('imports the chosen files, then shows the result', async () => {
        const onImport = jest.fn().mockResolvedValue({imported: ['org.a.cfg'], failed: []});
        await renderImport({onImport});
        await checkWith('the-right-password');
        fireEvent.click(screen.getByRole('checkbox', {name: 'org.b.cfg'}));
        fireEvent.click(screen.getByRole('button', {name: 'archive.import.confirm:1'}));
        await flush();

        expect(onImport).toHaveBeenCalledWith('QUJD', 'the-right-password', ['org.a.cfg']);
        expect(document.activeElement).toHaveAttribute('data-cy', 'archive-import-result');
        expect(screen.getByText('archive.import.resultSummary:1')).toBeInTheDocument();
        expect(screen.getByRole('dialog', {name: 'archive.import.resultTitle'})).toBeInTheDocument();
        // The review said to encrypt api.token: the result says it again, where it is done.
        expect(screen.getByText('org.a.cfg: api.token')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'archive.import.done'})).toBeInTheDocument();
    });

    it('refuses to import nothing', async () => {
        const {onImport} = await renderImport();
        await checkWith('the-right-password');
        fireEvent.click(screen.getByRole('button', {name: 'archive.export.clearSelection'}));
        fireEvent.click(screen.getByRole('button', {name: 'archive.import.confirm:0'}));
        await flush();

        expect(onImport).not.toHaveBeenCalled();
        const list = screen.getByRole('list', {name: 'archive.import.listLabel'});
        expect(document.activeElement).toBe(list);
        expect(list).toHaveAccessibleDescription('archive.import.errorNoSelection');
    });

    it('lists the files that failed', async () => {
        await renderImport({onImport: jest.fn().mockResolvedValue({imported: [], failed: [{name: 'org.a.cfg', error: 'Import denied'}]})});
        await checkWith('the-right-password');
        fireEvent.click(screen.getByRole('button', {name: 'archive.import.confirm:2'}));
        await flush();

        expect(screen.getByText('org.a.cfg: Import denied')).toBeInTheDocument();
        expect(screen.getByText('archive.import.resultFailed:1')).toBeInTheDocument();
    });
});
