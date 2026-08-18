import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: jest.fn() })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: key => key })
}));

/**
 * Review-before-save gate.
 *
 * DiffModal was rendered and its state existed, but nothing ever set isOpen to true, so the
 * feature was inert. handleSave now opens it when the computed content differs from what is on
 * disk, and persists only through the confirm path.
 */
describe('useOsgiConfigs - review-before-save diff', () => {
    const FILE = { name: 'test.cfg' };
    const ON_DISK = 'a = 1\n';

    const mountWithFile = async () => {
        const hook = renderHook(() => useOsgiConfigs());

        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        await act(async () => {
            hook.result.current.selectFile(FILE);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        return hook;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        osgiService.getPreference.mockResolvedValue({});
        osgiService.setPreference.mockResolvedValue({});
        osgiService.decrypt.mockResolvedValue({});
        osgiService.encrypt.mockResolvedValue({});
        osgiService.getAll.mockResolvedValue({
            files: [FILE],
            uiConfig: { visualFormattingControlsEnabled: false }
        });
        osgiService.read.mockResolvedValue({ data: { rawContent: ON_DISK } });
        osgiService.save.mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('opens the diff instead of saving when the content changed', async () => {
        const { result } = await mountWithFile();

        act(() => {
            result.current.handleRawUpdate('a = 2\n');
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(result.current.diffConfig.isOpen).toBe(true);
        expect(result.current.diffConfig.originalContent).toBe(ON_DISK);
        expect(result.current.diffConfig.newContent).toBe('a = 2\n');
        expect(result.current.diffConfig.filename).toBe('test.cfg');
        // The whole point: nothing is written until the user confirms.
        expect(osgiService.save).not.toHaveBeenCalled();
    });

    it('persists the reviewed content when the diff is confirmed', async () => {
        const { result } = await mountWithFile();

        act(() => {
            result.current.handleRawUpdate('a = 2\n');
        });
        await act(async () => {
            await result.current.handleSave();
        });

        // Guard the ordering, not just the final state: without the gate, save would already have
        // happened here and this test would pass for the wrong reason.
        expect(osgiService.save).not.toHaveBeenCalled();

        await act(async () => {
            result.current.diffConfig.onConfirm();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(osgiService.save).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'save', filename: 'test.cfg', rawContent: 'a = 2\n' })
        );
        expect(result.current.diffConfig.isOpen).toBe(false);
    });

    it('saves directly, with no diff, when nothing changed', async () => {
        const { result } = await mountWithFile();

        // rawContent still equals what was read from disk.
        await act(async () => {
            await result.current.handleSave();
        });

        expect(result.current.diffConfig.isOpen).toBe(false);
        expect(osgiService.save).toHaveBeenCalledWith(
            expect.objectContaining({ filename: 'test.cfg', rawContent: ON_DISK })
        );
    });
});
