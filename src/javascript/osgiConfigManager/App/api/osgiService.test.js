import { osgiService } from './osgiService';

// The GraphQL answers are mapped back onto the response shapes the hooks already consume
// ({files, uiConfig}, {data}, {metatypes}, {status}, ...), so nothing above this module changed
// when the transport moved from the Action to GraphQL.

global.fetch = jest.fn();

const respond = (osgiConfigManager) => fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { osgiConfigManager } })
});

describe('osgiService response mapping', () => {
    beforeEach(() => fetch.mockReset());

    it('getAll returns the listing and the UI config', async () => {
        const files = [{ name: 'a.cfg', path: '/opt/etc/a.cfg', enabled: true, type: 'cfg', configState: 'USER' }];
        respond({ files, uiConfig: { visualFormattingControlsEnabled: true } });

        await expect(osgiService.getAll()).resolves.toEqual({
            files,
            uiConfig: { visualFormattingControlsEnabled: true }
        });
    });

    it('read parses properties and metatype, keeping key order, and drops absent fields', async () => {
        respond({
            file: {
                configState: 'MODULE',
                rawContent: 'zeta = 1\nalpha = 2\n',
                pid: 'org.acme',
                properties: '{"zeta":"1","alpha":"2"}',
                metatype: null
            }
        });

        const { data } = await osgiService.read('org.acme.cfg');

        expect(data).toEqual({
            configState: 'MODULE',
            rawContent: 'zeta = 1\nalpha = 2\n',
            pid: 'org.acme',
            properties: { zeta: '1', alpha: '2' }
        });
        expect(Object.keys(data.properties)).toEqual(['zeta', 'alpha']);
    });

    it('getAvailableMetatypes parses the JSON array', async () => {
        respond({ availableMetatypes: '[{"pid":"org.acme","filename":"org.acme.cfg"}]' });

        await expect(osgiService.getAvailableMetatypes())
            .resolves.toEqual({ metatypes: [{ pid: 'org.acme', filename: 'org.acme.cfg' }] });
    });

    it.each([
        ['save', () => osgiService.save({ action: 'save', filename: 'a.cfg', rawContent: '' }), { save: true }, 'saved'],
        ['toggle', () => osgiService.toggle('a.cfg'), { toggle: true }, 'toggled'],
        ['delete', () => osgiService.delete('a.cfg'), { delete: true }, 'deleted'],
        ['markAsDefault', () => osgiService.markAsDefault('a.cfg'), { markAsDefault: true }, 'updated'],
        ['create', () => osgiService.create('a.cfg'), { create: true }, 'created']
    ])('%s reports the status the hooks expect', async (_name, invoke, answer, status) => {
        respond(answer);

        await expect(invoke()).resolves.toEqual({ status });
    });

    it('createFromMetatype returns the created file name', async () => {
        respond({ createFromMetatype: 'org.acme.cfg' });

        await expect(osgiService.createFromMetatype('org.acme'))
            .resolves.toEqual({ status: 'created', filename: 'org.acme.cfg' });
    });

    it('encrypt and decrypt return the transformed value', async () => {
        respond({ encrypt: 'ENC(x)' });
        await expect(osgiService.encrypt('s')).resolves.toEqual({ encryptedValue: 'ENC(x)' });

        respond({ decrypt: 's' });
        await expect(osgiService.decrypt('ENC(x)', 'a.cfg')).resolves.toEqual({ decryptedValue: 's' });
    });

    it('getPreference omits value when the preference is unset', async () => {
        respond({ preference: 'raw' });
        await expect(osgiService.getPreference('osgiEditorMode')).resolves.toEqual({ value: 'raw' });

        respond({ preference: null });
        await expect(osgiService.getPreference('osgiEditorMode')).resolves.toEqual({});
    });

    it('setPreference only reports success when something was stored', async () => {
        respond({ setPreference: true });
        await expect(osgiService.setPreference('k', 'v')).resolves.toEqual({ status: 'preferenceSaved' });

        respond({ setPreference: false });
        await expect(osgiService.setPreference('k', 'v')).resolves.toEqual({});
    });
});

describe('osgiService errors', () => {
    beforeEach(() => fetch.mockReset());

    it('throws the server message, carrying its code, for a GraphQL error', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: null,
                errors: [{ message: 'Access denied: conf.cfg is reserved', extensions: { code: 'FORBIDDEN' } }]
            })
        });

        const error = await osgiService.read('conf.cfg').catch(e => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Access denied: conf.cfg is reserved');
        expect(error.code).toBe('FORBIDDEN');
    });

    it('throws the HTTP status when the endpoint fails outright', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: async () => { throw new SyntaxError('not JSON'); }
        });

        await expect(osgiService.getAll()).rejects.toThrow('Bad Gateway');
    });
});
