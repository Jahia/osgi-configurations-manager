import { osgiService } from './osgiService';

global.fetch = jest.fn();

describe('osgiService', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('getAll fetches correctly without params', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ files: [] })
        });

        await osgiService.getAll();
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('systemsite.osgiConfigManager.do'));
        expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining('?search='));
    });

    it('getAll fetches correctly with deep search', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ files: [] })
        });

        await osgiService.getAll('foo', true);
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('?search=foo'));
    });

    it('read fetches specific file', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ data: {} })
        });

        await osgiService.read('test.cfg');
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('?filename=test.cfg'));
    });

    it('save sends POST request', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ status: 'saved' })
        });

        const payload = { action: 'save', filename: 'test.cfg' };
        await osgiService.save(payload);

        expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(payload)
        }));
    });

    it('handles error response triggers error', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            statusText: 'Internal Server Error',
            headers: { get: () => 'text/plain' },
            text: async () => 'Something went wrong'
        });

        await expect(osgiService.getAll()).rejects.toThrow('Something went wrong');
    });
});
