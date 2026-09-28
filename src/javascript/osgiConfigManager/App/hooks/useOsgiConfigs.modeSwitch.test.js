import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

// Switching to raw mode regenerates the text from the visual properties. Before the file has
// loaded those properties are empty, so a quick switch showed an empty editor, and saving it
// then wiped the file. The switch is therefore refused until the load has finished.

jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));

const deferred = () => {
    let resolve;
    const promise = new Promise(r => {
        resolve = r;
    });
    return { promise, resolve };
};

describe('useOsgiConfigs — editor mode switch while a file loads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        osgiService.getPreference.mockImplementation(key =>
            Promise.resolve(key === 'osgiEditorMode' ? { value: 'visual' } : {}));
        osgiService.setPreference.mockResolvedValue({});
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'a.cfg' }] });
    });

    it('ignores a switch to raw mode until the file has loaded, then builds it from the file', async () => {
        const read = deferred();
        osgiService.read.mockReturnValue(read.promise);

        const { result, waitFor } = renderHook(() => useOsgiConfigs());
        await waitFor(() => expect(result.current.isRawMode).toBe(false));
        act(() => {
            result.current.selectFile({ name: 'a.cfg' });
        });
        expect(result.current.loadingFile).toBe(true);

        await act(async () => {
            await result.current.handleSetEditorMode('raw');
        });
        expect(result.current.isRawMode).toBe(false);
        expect(osgiService.setPreference).not.toHaveBeenCalledWith('osgiEditorMode', expect.anything());

        await act(async () => {
            read.resolve({ data: { rawContent: 'password = kept\n', properties: [] } });
            await read.promise;
        });
        expect(result.current.loadingFile).toBe(false);

        await act(async () => {
            await result.current.handleSetEditorMode('raw');
        });
        expect(result.current.isRawMode).toBe(true);
        expect(result.current.rawContent).toContain('password = kept');
        expect(osgiService.setPreference).toHaveBeenCalledWith('osgiEditorMode', 'raw');
    });

    it('abandons a switch when another file starts loading before it completes', async () => {
        osgiService.read.mockResolvedValueOnce({ data: { rawContent: 'password = first\n', properties: [] } });
        const { result, waitFor } = renderHook(() => useOsgiConfigs());
        await waitFor(() => expect(result.current.isRawMode).toBe(false));
        await act(async () => {
            result.current.selectFile({ name: 'a.cfg' });
        });
        expect(result.current.loadingFile).toBe(false);

        const secondRead = deferred();
        osgiService.read.mockReturnValueOnce(secondRead.promise);
        await act(async () => {
            const switching = result.current.handleSetEditorMode('raw');
            result.current.selectFile({ name: 'b.cfg' });
            await switching;
        });
        expect(result.current.isRawMode).toBe(false);

        await act(async () => {
            secondRead.resolve({ data: { rawContent: 'token = second\n', properties: [] } });
            await secondRead.promise;
        });
        expect(result.current.rawContent).toBe('token = second\n');
    });
});
