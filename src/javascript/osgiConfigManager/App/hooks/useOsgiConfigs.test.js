import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

// Mock the service
jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({
        success: jest.fn(),
        error: jest.fn()
    })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe('useOsgiConfigs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        osgiService.getPreference.mockResolvedValue({});
        osgiService.setPreference.mockResolvedValue({});
        osgiService.decrypt.mockResolvedValue({});
        osgiService.encrypt.mockResolvedValue({});
    });

    it('fetched files on mount', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'test.cfg' }], uiConfig: { visualFormattingControlsEnabled: false } });

        const { result } = renderHook(() => useOsgiConfigs());

        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.loadingFiles).toBe(false);
        expect(result.current.files).toEqual([{ name: 'test.cfg' }]);
        expect(osgiService.getAll).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('keeps visual formatting controls disabled and comments hidden by default', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'test.cfg' }], uiConfig: { visualFormattingControlsEnabled: false } });
        osgiService.getPreference
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ value: 'true' })
            .mockResolvedValueOnce({ value: 'true' });

        const { result } = renderHook(() => useOsgiConfigs());

        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.visualFormattingControlsEnabled).toBe(false);
        expect(result.current.showComments).toBe(false);
        expect(result.current.showEmptyLines).toBe(false);
        jest.useRealTimers();
    });

    it('handleDeleteFile calls service and refreshes', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [] });
        osgiService.delete.mockResolvedValue({});

        const { result } = renderHook(() => useOsgiConfigs());

        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        // Simulate delete
        act(() => {
            result.current.handleDeleteFile({ name: 'test.cfg' });
        });

        expect(result.current.modalConfig).not.toBeNull();
        expect(result.current.modalConfig.type).toBe('confirm');

        // Execute the confirm callback
        await act(async () => {
            await result.current.modalConfig.onConfirm();
            await Promise.resolve();
        });

        expect(osgiService.delete).toHaveBeenCalledWith('test.cfg');

        // Refresh triggers fetch calls? fetchFiles logic:
        // handleDelete calls fetchFiles directly.
        // fetchFiles is NOT debounced directly, but the useEffect calls it with debounce.
        // Wait, handleDeleteFile calls `fetchFiles()` directly, which is `const fetchFiles = useCallback(...)`.
        // So it should be immediate.
        expect(osgiService.getAll).toHaveBeenCalledTimes(2); // Initial load + refresh
        jest.useRealTimers();
    });

    it('handleSave calls service', async () => {
        osgiService.save.mockResolvedValue({});
        // Mock file content fetch
        osgiService.read.mockResolvedValue({ data: { rawContent: 'foo = bar', properties: [] } });

        const { result } = renderHook(() => useOsgiConfigs());
        // Select a file to populate state
        act(() => {
            result.current.setSelectedFile({ name: 'test.cfg' });
        });

        // triggers fetchFileContent
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(osgiService.save).toHaveBeenCalledWith(expect.objectContaining({
            action: 'save',
            filename: 'test.cfg'
        }));
    });
});
