import { renderHook, act } from '@testing-library/react-hooks';
import { useOsgiConfigs } from './useOsgiConfigs';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: key => key })
}));

const flush = async () => {
    for (let i = 0; i < 8; i++) {
        await Promise.resolve();
    }
};

/**
 * Saving the manager's own configuration: the server applies it only once Felix FileInstall
 * notices the file, up to about ten seconds later on macOS, and a reload meanwhile showed the old
 * setting. The page now asks again until the server reports the value the file sets.
 */
describe('useOsgiConfigs - manager settings after a save', () => {
    const mountWithFile = async file => {
        osgiService.getAll.mockResolvedValue({
            files: [file],
            uiConfig: { visualFormattingControlsEnabled: false }
        });
        const hook = renderHook(() => useOsgiConfigs());
        await act(async () => {
            jest.advanceTimersByTime(500);
            await flush();
        });
        await act(async () => {
            hook.result.current.selectFile(file);
            await flush();
        });
        return hook;
    };

    const save = async (result, content) => {
        await act(async () => {
            result.current.handleRawUpdate(content);
        });
        await act(async () => {
            await result.current.handleSave(content);
            await flush();
        });
    };

    const tick = async () => {
        await act(async () => {
            jest.advanceTimersByTime(1000);
            await flush();
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        osgiService.getPreference.mockResolvedValue({});
        osgiService.setPreference.mockResolvedValue({});
        osgiService.decrypt.mockResolvedValue({});
        osgiService.encrypt.mockResolvedValue({});
        osgiService.read.mockResolvedValue({ data: { rawContent: 'visualFormattingControlsEnabled = false\n' } });
        osgiService.save.mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows the new setting once the server applied it, without a reload', async () => {
        const { result } = await mountWithFile({ name: 'org.jahia.modules.osgiconfigmanager.cfg' });
        osgiService.getUiConfig
            .mockResolvedValueOnce({ visualFormattingControlsEnabled: false })
            .mockResolvedValueOnce({ visualFormattingControlsEnabled: false })
            .mockResolvedValue({ visualFormattingControlsEnabled: true });

        await save(result, 'visualFormattingControlsEnabled = true\n');
        expect(result.current.visualFormattingControlsEnabled).toBe(false);

        await tick();
        expect(result.current.visualFormattingControlsEnabled).toBe(false);
        await tick();
        expect(result.current.visualFormattingControlsEnabled).toBe(true);

        const calls = osgiService.getUiConfig.mock.calls.length;
        await tick();
        await tick();
        expect(osgiService.getUiConfig).toHaveBeenCalledTimes(calls);
    });

    it('gives up after twenty seconds', async () => {
        const { result } = await mountWithFile({ name: 'org.jahia.modules.osgiconfigmanager.cfg' });
        osgiService.getUiConfig.mockResolvedValue({ visualFormattingControlsEnabled: false });

        await save(result, 'visualFormattingControlsEnabled = true\n');
        for (let i = 0; i < 25; i++) {
            await tick();
        }

        expect(osgiService.getUiConfig).toHaveBeenCalledTimes(20);
        expect(result.current.visualFormattingControlsEnabled).toBe(false);
    });

    it('does not ask again after saving another file', async () => {
        const { result } = await mountWithFile({ name: 'org.example.cfg' });

        await save(result, 'visualFormattingControlsEnabled = true\n');
        await tick();

        expect(osgiService.getUiConfig).not.toHaveBeenCalled();
    });
});
