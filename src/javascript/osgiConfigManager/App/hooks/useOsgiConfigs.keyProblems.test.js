import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

const mockToastError = jest.fn(() => 7);
const mockDismiss = jest.fn();
jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: mockToastError, warning: jest.fn(), dismiss: mockDismiss })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key, options) => (options && options.count !== undefined ? `${key}:${options.count}` : key) })
}));

/**
 * A blank key was saved as " = value" with no warning, and duplicate keys were reported only in a
 * dialog. The visual editor now refuses the save, marks the faulty keys and moves the focus there.
 */
describe('useOsgiConfigs - keys that cannot be saved', () => {
    const FILE = { name: 'test.cfg' };

    const mountVisual = async () => {
        const hook = renderHook(() => useOsgiConfigs());
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            hook.result.current.selectFile(FILE);
            for (let i = 0; i < 6; i++) {
                await Promise.resolve();
            }
        });
        return hook;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        osgiService.getPreference.mockImplementation(name => Promise.resolve(name === 'osgiEditorMode' ? { value: 'visual' } : {}));
        osgiService.setPreference.mockResolvedValue({});
        osgiService.decrypt.mockResolvedValue({});
        osgiService.encrypt.mockResolvedValue({});
        osgiService.getAll.mockResolvedValue({ files: [FILE], uiConfig: { visualFormattingControlsEnabled: false } });
        osgiService.read.mockResolvedValue({ data: { rawContent: 'a = 1\nb = 2\n' } });
        osgiService.save.mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('refuses a duplicate key, case aside, without the review dialog, and asks for the focus', async () => {
        const { result } = await mountVisual();
        expect(result.current.isRawMode).toBe(false);
        expect(Array.isArray(result.current.properties)).toBe(true);

        act(() => {
            result.current.handlePropUpdate([1, 'key'], 'value', 'A');
        });
        await act(async () => {
            await result.current.handleSave();
        });

        expect(osgiService.save).not.toHaveBeenCalled();
        expect(result.current.diffConfig.isOpen).toBe(false);
        expect(result.current.modalConfig).toBeNull();
        expect(result.current.showKeyProblems).toBe(true);
        expect(result.current.keyProblemsFocusRequest).toBe(1);

        act(() => {
            jest.advanceTimersByTime(200);
        });
        expect(mockToastError).toHaveBeenCalledWith('editor.validation.saveSummary:2');
    });

    it('refuses a blank key, and clears the errors and their notification once the file is reloaded', async () => {
        const { result } = await mountVisual();

        act(() => {
            result.current.handlePropUpdate([0, 'key'], 'value', '  ');
        });
        await act(async () => {
            await result.current.handleSave();
        });
        act(() => {
            jest.advanceTimersByTime(200);
        });
        expect(osgiService.save).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith('editor.validation.saveSummary:1');

        await act(async () => {
            await result.current.handleCancelChanges();
        });
        expect(result.current.showKeyProblems).toBe(false);
        expect(mockDismiss).toHaveBeenCalledWith(7);
    });
});
