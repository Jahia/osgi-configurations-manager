import { osgiService } from './osgiService';

// Locks the HTTP request shape (method, URL, body) of every osgiService method.
// The upcoming CSRF work will add a token header to the mutating calls; these
// tests ensure that change does not silently alter the existing payloads/URLs.

global.fetch = jest.fn();

const okJson = () => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({})
});

const lastCall = () => fetch.mock.calls[fetch.mock.calls.length - 1];

describe('osgiService request contract', () => {
    beforeEach(() => {
        fetch.mockReset();
        fetch.mockResolvedValue(okJson());
    });

    it.each([
        ['toggle', () => osgiService.toggle('conf.cfg'), '{"action":"toggle","filename":"conf.cfg"}'],
        ['delete', () => osgiService.delete('conf.cfg'), '{"action":"delete","filename":"conf.cfg"}'],
        ['markAsDefault', () => osgiService.markAsDefault('conf.cfg'), '{"action":"markAsDefault","filename":"conf.cfg"}'],
        ['create', () => osgiService.create('conf.cfg'), '{"action":"create","filename":"conf.cfg"}'],
        ['encrypt', () => osgiService.encrypt('sec'), '{"action":"encrypt","value":"sec"}'],
        ['decrypt', () => osgiService.decrypt('sec'), '{"action":"decrypt","value":"sec"}'],
        ['setPreference', () => osgiService.setPreference('k', 'v'), '{"action":"setPreference","key":"k","value":"v"}']
    ])('%s issues a POST with the expected JSON body', async (_name, invoke, expectedBody) => {
        await invoke();

        const [url, options] = lastCall();
        expect(url).toEqual(expect.stringContaining('systemsite.osgiConfigManager.do'));
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(options.body).toBe(expectedBody);
    });

    it('createFromMetatype posts pid and instanceIdentifier', async () => {
        await osgiService.createFromMetatype('my.pid', 'inst1');

        const [, options] = lastCall();
        expect(options.method).toBe('POST');
        expect(options.body).toBe('{"action":"createFromMetatype","pid":"my.pid","instanceIdentifier":"inst1"}');
    });

    it('getPreference issues a GET with action and key in the query string', async () => {
        await osgiService.getPreference('osgiEditorMode');

        const [url, options] = lastCall();
        expect(url).toEqual(expect.stringContaining('?action=getPreference&key=osgiEditorMode'));
        // GET => no options object passed
        expect(options).toBeUndefined();
    });

    it('getAvailableMetatypes issues a GET for availableMetatypes', async () => {
        await osgiService.getAvailableMetatypes();

        const [url] = lastCall();
        expect(url).toEqual(expect.stringContaining('?action=availableMetatypes'));
    });

    it('throws the server-provided message for a JSON error response', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            statusText: 'Bad Request',
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'Access denied: conf.cfg is reserved' })
        });

        await expect(osgiService.save({ action: 'save', filename: 'conf.cfg' }))
            .rejects.toThrow('Access denied: conf.cfg is reserved');
    });
});
