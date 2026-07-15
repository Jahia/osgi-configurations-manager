import { osgiService } from './osgiService';

// S30-NEW (G17): every state-changing client call must POST to the hardcoded .do endpoint
// with an application/json Content-Type (load-bearing for the CSRF guard U3/S21) and the
// expected JSON body. The existing osgiService.test.js only asserts method+body for `save`.

global.fetch = jest.fn();

const okJson = (payload = {}) => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => payload
});

const lastCall = () => fetch.mock.calls[fetch.mock.calls.length - 1];

const expectJsonPost = (expectedBody) => {
    const [url, init] = lastCall();
    expect(url).toEqual(expect.stringContaining('systemsite.osgiConfigManager.do'));
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json' }));
    expect(JSON.parse(init.body)).toEqual(expectedBody);
};

describe('osgiService — all actions send JSON POSTs to the .do endpoint', () => {
    beforeEach(() => fetch.mockClear());

    it('toggle', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'toggled' }));
        await osgiService.toggle('x.cfg');
        expectJsonPost({ action: 'toggle', filename: 'x.cfg' });
    });

    it('delete', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'deleted' }));
        await osgiService.delete('x.cfg');
        expectJsonPost({ action: 'delete', filename: 'x.cfg' });
    });

    it('create', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'created' }));
        await osgiService.create('x.cfg');
        expectJsonPost({ action: 'create', filename: 'x.cfg' });
    });

    it('markAsDefault', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'updated' }));
        await osgiService.markAsDefault('x.cfg');
        expectJsonPost({ action: 'markAsDefault', filename: 'x.cfg' });
    });

    it('createFromMetatype (with instance identifier)', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'created', filename: 'com.acme-i1.cfg' }));
        await osgiService.createFromMetatype('com.acme', 'i1');
        expectJsonPost({ action: 'createFromMetatype', pid: 'com.acme', instanceIdentifier: 'i1' });
    });

    it('encrypt', async () => {
        fetch.mockResolvedValueOnce(okJson({ encryptedValue: 'ENC(iv:ct)' }));
        await osgiService.encrypt('secret');
        expectJsonPost({ action: 'encrypt', value: 'secret' });
    });

    it('decrypt', async () => {
        fetch.mockResolvedValueOnce(okJson({ decryptedValue: 'secret' }));
        await osgiService.decrypt('ENC(iv:ct)');
        expectJsonPost({ action: 'decrypt', value: 'ENC(iv:ct)' });
    });

    it('setPreference', async () => {
        fetch.mockResolvedValueOnce(okJson({ status: 'preferenceSaved' }));
        await osgiService.setPreference('osgiCM.showComments', 'true');
        expectJsonPost({ action: 'setPreference', key: 'osgiCM.showComments', value: 'true' });
    });

    it('getPreference uses a GET with the key query param', async () => {
        fetch.mockResolvedValueOnce(okJson({ value: 'true' }));
        await osgiService.getPreference('osgiCM.showComments');
        const [url, init] = lastCall();
        expect(url).toEqual(expect.stringContaining('?action=getPreference&key=osgiCM.showComments'));
        expect(init).toBeUndefined();
    });

    it('getAvailableMetatypes uses a GET with the availableMetatypes query param', async () => {
        fetch.mockResolvedValueOnce(okJson({ metatypes: [] }));
        await osgiService.getAvailableMetatypes();
        const [url] = lastCall();
        expect(url).toEqual(expect.stringContaining('?action=availableMetatypes'));
    });
});
