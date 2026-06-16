import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

// Mock the service
jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({
        success: jest.fn(),
        error: jest.fn(),
        warning: jest.fn()
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

    const flushMicrotasks = async (times = 20) => {
        for (let i = 0; i < times; i++) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }
    };

    it('decrypts ENC(...) values on load while keeping raw content encrypted', async () => {
        osgiService.getAll.mockResolvedValue({ files: [] });
        osgiService.read.mockResolvedValue({
            data: { rawContent: 'password = ENC(cipher)', properties: [] }
        });
        osgiService.decrypt.mockResolvedValue({ decryptedValue: 's3cret' });

        const { result } = renderHook(() => useOsgiConfigs());
        // selectFile (not the bare setter) triggers fetchFileContent.
        await act(async () => {
            result.current.selectFile({ name: 'creds.cfg' });
            await flushMicrotasks();
        });

        // The on-disk/raw view stays encrypted (decrypt-in-memory model)...
        expect(result.current.rawContent).toBe('password = ENC(cipher)');
        // ...and the file-bound decrypt was invoked with the selected filename.
        expect(osgiService.decrypt).toHaveBeenCalledWith('ENC(cipher)', 'creds.cfg');
    });

    it('toggles between raw and visual modes, encrypting on the way back to raw', async () => {
        osgiService.getAll.mockResolvedValue({ files: [] });
        osgiService.read.mockResolvedValue({
            data: { rawContent: 'password = ENC(cipher)', properties: [] }
        });
        osgiService.decrypt.mockResolvedValue({ decryptedValue: 's3cret' });
        osgiService.encrypt.mockResolvedValue({ encryptedValue: 'ENC(cipher)' });

        const { result } = renderHook(() => useOsgiConfigs());
        await act(async () => {
            result.current.selectFile({ name: 'creds.cfg' });
            await flushMicrotasks();
        });

        expect(result.current.isRawMode).toBe(true);

        // Switch to visual mode → decrypts the tree in memory.
        await act(async () => {
            await result.current.handleToggleRawMode();
            await flushMicrotasks();
        });
        expect(result.current.isRawMode).toBe(false);

        // Switch back to raw → re-encrypts before serializing.
        await act(async () => {
            await result.current.handleToggleRawMode();
            await flushMicrotasks();
        });
        expect(result.current.isRawMode).toBe(true);
        expect(osgiService.encrypt).toHaveBeenCalled();
    });

    it('handleSave shows a diff and persists only after confirmation when content changed', async () => {
        osgiService.save.mockResolvedValue({});
        osgiService.read.mockResolvedValue({ data: { rawContent: 'foo = bar', properties: [] } });

        const { result } = renderHook(() => useOsgiConfigs());
        act(() => {
            result.current.setSelectedFile({ name: 'test.cfg' });
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        // Edit raw content so there is a real change to review
        act(() => {
            result.current.handleRawUpdate('foo = baz');
        });

        await act(async () => {
            await result.current.handleSave();
        });

        // Not persisted yet: the diff modal is open for review
        expect(osgiService.save).not.toHaveBeenCalled();
        expect(result.current.diffConfig.isOpen).toBe(true);
        expect(result.current.diffConfig.newContent).toBe('foo = baz');

        // Confirming the diff persists the content
        await act(async () => {
            result.current.diffConfig.onConfirm();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(osgiService.save).toHaveBeenCalledWith(expect.objectContaining({
            action: 'save',
            filename: 'test.cfg',
            rawContent: 'foo = baz'
        }));
    });
});
