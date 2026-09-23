import { osgiService } from './osgiService';

// Locks the request every osgiService method sends: one POST to /modules/graphql, carrying the
// headers the server requires of a mutation (X-Requested-With plus an application/json body are
// its CSRF defence), an operation under the single osgiConfigManager namespace, and variables
// rather than values spliced into the query text.

global.fetch = jest.fn();

const okGraphQL = (osgiConfigManager = {}) => ({
    ok: true,
    json: async () => ({ data: { osgiConfigManager } })
});

const lastRequest = () => {
    const [url, init] = fetch.mock.calls[fetch.mock.calls.length - 1];
    return { url, init, body: JSON.parse(init.body) };
};

describe('osgiService request contract', () => {
    beforeEach(() => {
        fetch.mockReset();
        fetch.mockResolvedValue(okGraphQL());
    });

    it.each([
        ['getAll', () => osgiService.getAll(), 'query', {}],
        ['getAll (deep)', () => osgiService.getAll('foo', true), 'query', { search: 'foo' }],
        ['read', () => osgiService.read('conf.cfg'), 'query', { name: 'conf.cfg' }],
        ['getAvailableMetatypes', () => osgiService.getAvailableMetatypes(), 'query', {}],
        ['getPreference', () => osgiService.getPreference('osgiEditorMode'), 'query', { key: 'osgiEditorMode' }],
        ['save', () => osgiService.save({ action: 'save', filename: 'conf.cfg', rawContent: 'a = 1\n' }),
            'mutation', { name: 'conf.cfg', rawContent: 'a = 1\n' }],
        ['toggle', () => osgiService.toggle('conf.cfg'), 'mutation', { name: 'conf.cfg' }],
        ['delete', () => osgiService.delete('conf.cfg'), 'mutation', { name: 'conf.cfg' }],
        ['markAsDefault', () => osgiService.markAsDefault('conf.cfg'), 'mutation', { name: 'conf.cfg' }],
        ['create', () => osgiService.create('conf.cfg'), 'mutation', { name: 'conf.cfg' }],
        ['createFromMetatype', () => osgiService.createFromMetatype('my.pid', 'inst1'),
            'mutation', { pid: 'my.pid', instanceIdentifier: 'inst1' }],
        ['encrypt', () => osgiService.encrypt('sec'), 'mutation', { value: 'sec' }],
        ['decrypt', () => osgiService.decrypt('ENC(sec)', 'conf.cfg'), 'mutation', { value: 'ENC(sec)', name: 'conf.cfg' }],
        ['setPreference', () => osgiService.setPreference('k', 'v'), 'mutation', { key: 'k', value: 'v' }]
    ])('%s POSTs a GraphQL %s to /modules/graphql', async (_name, invoke, operation, variables) => {
        // Only the request is under test here; the empty answer may legitimately be rejected.
        await invoke().catch(() => undefined);

        const { url, init, body } = lastRequest();
        expect(url).toMatch(/\/modules\/graphql$/);
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' });
        expect(body.query.trim().startsWith(operation)).toBe(true);
        expect(body.query).toContain('osgiConfigManager');
        expect(body.variables).toEqual(variables);
    });

    it('never splices a caller value into the query text', async () => {
        await osgiService.save({ action: 'save', filename: 'x"){evil}', rawContent: '"}}' });

        expect(lastRequest().body.query).not.toContain('evil');
    });

    it('decrypt names the file the value belongs to (file-bound, not an oracle)', async () => {
        await osgiService.decrypt('ENC(sec)', 'conf.cfg');

        expect(lastRequest().body.query).toMatch(/decrypt\(\s*name:\s*\$name/);
    });

    it('does not send a search term unless a deep search was asked for', async () => {
        await osgiService.getAll('foo', false);

        expect(lastRequest().body.variables).toEqual({});
    });
});
