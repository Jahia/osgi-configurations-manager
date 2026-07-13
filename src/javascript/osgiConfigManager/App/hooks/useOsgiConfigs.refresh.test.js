import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

// S32 (G18): handleRefreshFiles re-fetches the listing (and the selected file's content),
// honouring the deep-search mode. The dirty-guard confirm modal that precedes a refresh while
// there are unsaved edits is enforced at the App/header component layer (see Cypress
// 01-config-lifecycle "unsaved changes" guard), not inside this hook — noted for Stage 6.

jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: jest.fn() })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));

describe('useOsgiConfigs — refresh', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        osgiService.getPreference.mockResolvedValue({});
        osgiService.setPreference.mockResolvedValue({});
    });

    it('handleRefreshFiles re-calls getAll (shallow list mode)', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'a.cfg' }] });

        const { result } = renderHook(() => useOsgiConfigs());
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });
        const callsAfterMount = osgiService.getAll.mock.calls.length;

        await act(async () => {
            await result.current.handleRefreshFiles();
        });

        expect(osgiService.getAll.mock.calls.length).toBe(callsAfterMount + 1);
        // shallow mode => plain getAll() with no deep-search args
        expect(osgiService.getAll).toHaveBeenLastCalledWith();
        jest.useRealTimers();
    });

    it('handleRefreshFiles preserves deep-search mode (getAll(term, true))', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [] });

        const { result } = renderHook(() => useOsgiConfigs());
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        act(() => {
            result.current.setSearchTerm('token');
            result.current.setSearchInContent(true);
        });
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });

        await act(async () => {
            await result.current.handleRefreshFiles();
        });

        expect(osgiService.getAll).toHaveBeenLastCalledWith('token', true);
        jest.useRealTimers();
    });

    it('handleRefreshFiles also re-reads the selected file content', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'a.cfg' }] });
        osgiService.read.mockResolvedValue({ data: { rawContent: 'k=v', properties: [] } });

        const { result } = renderHook(() => useOsgiConfigs());
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        act(() => {
            result.current.setSelectedFile({ name: 'a.cfg' });
        });
        await act(async () => {
            await Promise.resolve();
        });
        osgiService.read.mockClear();

        await act(async () => {
            await result.current.handleRefreshFiles();
        });

        expect(osgiService.read).toHaveBeenCalledWith('a.cfg');
        jest.useRealTimers();
    });
});
