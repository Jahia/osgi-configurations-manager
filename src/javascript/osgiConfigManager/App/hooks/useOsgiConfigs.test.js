import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

// Mock the service
jest.mock('../api/osgiService');
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe('useOsgiConfigs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetched files on mount', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [{ name: 'test.cfg' }] });

        const { result, waitForNextUpdate } = renderHook(() => useOsgiConfigs());

        // Debounce is 500ms
        act(() => {
            jest.advanceTimersByTime(500);
        });

        await waitForNextUpdate(); // Wait for fetchFiles to complete

        expect(result.current.loadingFiles).toBe(false);
        expect(result.current.files).toEqual([{ name: 'test.cfg' }]);
        expect(osgiService.getAll).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('handleDeleteFile calls service and refreshes', async () => {
        jest.useFakeTimers();
        osgiService.getAll.mockResolvedValue({ files: [] });
        osgiService.delete.mockResolvedValue({});

        const { result, waitForNextUpdate } = renderHook(() => useOsgiConfigs());

        // Initial load
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await waitForNextUpdate();

        // Simulate delete
        act(() => {
            result.current.handleDeleteFile({ name: 'test.cfg' });
        });

        expect(result.current.modalConfig).not.toBeNull();
        expect(result.current.modalConfig.type).toBe('confirm');

        // Execute the confirm callback
        await act(async () => {
            await result.current.modalConfig.onConfirm();
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
        osgiService.read.mockResolvedValue({ data: { properties: { foo: 'bar' } } });

        const { result, waitForNextUpdate } = renderHook(() => useOsgiConfigs());
        // Select a file to populate state
        act(() => {
            result.current.setSelectedFile({ name: 'test.cfg' });
        });

        // triggers fetchFileContent
        await waitForNextUpdate();

        await act(async () => {
            await result.current.handleSave();
        });

        expect(osgiService.save).toHaveBeenCalledWith(expect.objectContaining({
            action: 'save',
            filename: 'test.cfg'
        }));
    });
});
