import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {BundleUsage} from './BundleUsage';
import {osgiService} from '../api/osgiService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        // The interpolation settings are not text: only the values are spelled out.
        t: (key, {interpolation: _interpolation, ...values} = {}) => (Object.keys(values).length ? `${key}:${Object.values(values).join(':')}` : key)
    })
}));

jest.mock('../api/osgiService', () => ({
    osgiService: {getBundleUsage: jest.fn()}
}));

const MAIL_BUNDLE = {
    symbolicName: 'org.example.mail.impl',
    name: 'Example Mail',
    version: '2.4.1',
    usages: [
        {kind: 'BOUND', detail: 'org.example.mail', states: []},
        {kind: 'COMPONENT', detail: 'org.example.mail.Mailer', states: ['ACTIVE']},
        {kind: 'METATYPE', detail: 'org.example.mail', states: []}
    ]
};

describe('BundleUsage', () => {
    beforeEach(() => osgiService.getBundleUsage.mockReset());

    it('lists each bundle with its version and how it uses the configuration', async () => {
        osgiService.getBundleUsage.mockResolvedValue([
            MAIL_BUNDLE,
            {symbolicName: 'org.example.other', name: 'org.example.other', version: '1.0.0',
                usages: [{kind: 'MANAGED_SERVICE', detail: 'org.example.mail', states: []}]}
        ]);

        render(<BundleUsage fileName="org.example.mail.cfg"/>);

        const items = await screen.findAllByRole('listitem');
        expect(osgiService.getBundleUsage).toHaveBeenCalledWith('org.example.mail.cfg');
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toBe(
            'Example Mail (org.example.mail.impl) bundleUsage.version:2.4.1 — bundleUsage.kind.bound, '
            + 'bundleUsage.componentWithStates:bundleUsage.kind.component:org.example.mail.Mailer:bundleUsage.state.active, '
            + 'bundleUsage.kind.metatype');
        // No Bundle-Name: the symbolic name is not repeated.
        expect(items[1].textContent).toBe('org.example.other bundleUsage.version:1.0.0 — bundleUsage.kind.managedService');
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('labels the section, so that the list is announced as what uses the file', async () => {
        osgiService.getBundleUsage.mockResolvedValue([MAIL_BUNDLE]);

        render(<BundleUsage fileName="org.example.mail.cfg"/>);

        expect(await screen.findByRole('group', {name: 'bundleUsage.title'})).toBeInTheDocument();
    });

    it('says so when no bundle uses the configuration', async () => {
        osgiService.getBundleUsage.mockResolvedValue([]);

        render(<BundleUsage fileName="org.example.unused.cfg"/>);

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('bundleUsage.empty'));
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('reports a failed lookup in its status, without the server message', async () => {
        osgiService.getBundleUsage.mockRejectedValue(new Error('Access denied: /opt/x/y.cfg'));

        render(<BundleUsage fileName="hidden.cfg"/>);

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('bundleUsage.error'));
    });

    // A live region mounted together with its text is not announced reliably (WCAG 4.1.3): the
    // first render, before any effect, has the region and no text yet.
    it('mounts its status region empty, before the loading text', () => {
        // Server rendering runs no effect, so it shows the first render; it needs TextEncoder, which jsdom lacks.
        // Required here, not imported: the polyfill must be in place before react-dom/server loads.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {renderToStaticMarkup} = require('react-dom/server');
        const markup = renderToStaticMarkup(<BundleUsage fileName="org.example.mail.cfg"/>);

        expect(markup).toContain('<div data-cy="bundle-usage-status" role="status"></div>');
        expect(osgiService.getBundleUsage).not.toHaveBeenCalled();
    });

    it('announces the loading, and waits for the file to load before asking', async () => {
        osgiService.getBundleUsage.mockResolvedValue([]);

        const {rerender} = render(<BundleUsage fileName="org.example.mail.cfg" isLoadingFile/>);

        expect(screen.getByRole('status').textContent).toBe('bundleUsage.loading');
        expect(osgiService.getBundleUsage).not.toHaveBeenCalled();

        rerender(<BundleUsage fileName="org.example.mail.cfg" isLoadingFile={false}/>);
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('bundleUsage.empty'));
        expect(osgiService.getBundleUsage).toHaveBeenCalledTimes(1);
    });

    it('drops the answer for a file that is no longer selected', async () => {
        let answerFirst;
        osgiService.getBundleUsage
            .mockImplementationOnce(() => new Promise(resolve => {
                answerFirst = resolve;
            }))
            .mockResolvedValueOnce([]);

        const {rerender} = render(<BundleUsage fileName="first.cfg"/>);
        rerender(<BundleUsage fileName="second.cfg"/>);
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('bundleUsage.empty'));

        answerFirst([MAIL_BUNDLE]);
        await Promise.resolve();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('describes a component with no configuration state, and an unknown state', async () => {
        osgiService.getBundleUsage.mockResolvedValue([{
            symbolicName: 'a', name: 'a', version: '1.0.0',
            usages: [
                {kind: 'COMPONENT', detail: 'a.One', states: []},
                {kind: 'COMPONENT', detail: 'a.Two', states: ['SOMETHING_NEW']}
            ]
        }]);

        render(<BundleUsage fileName="a.cfg"/>);

        const item = await screen.findByRole('listitem');
        expect(item.textContent).toBe('a bundleUsage.version:1.0.0 — '
            + 'bundleUsage.componentNamed:bundleUsage.kind.component:a.One, '
            + 'bundleUsage.componentWithStates:bundleUsage.kind.component:a.Two:bundleUsage.state.unknown');
    });
});
