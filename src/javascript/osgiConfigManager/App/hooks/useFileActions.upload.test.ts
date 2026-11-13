import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useFileActions } from './useFileActions';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');
const toastError = jest.fn();
jest.mock('./useToast', () => ({
    useToast: () => ({ success: jest.fn(), error: toastError, warning: jest.fn() })
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key) })
}));

const mockedService = osgiService as jest.Mocked<typeof osgiService>;

const setup = () => {
    const setModalConfig = jest.fn();
    const { result } = renderHook(() => useFileActions({
        selectedFile: null,
        fetchFiles: jest.fn().mockResolvedValue(undefined),
        fetchFileContent: jest.fn().mockResolvedValue(undefined),
        selectFile: jest.fn(),
        setSelectedFile: jest.fn(),
        setModalConfig
    }));
    return { actions: result.current, setModalConfig };
};

const upload = (name: string) => new File(['key = value\n'], name, { type: 'text/plain' });

// The overwrite check read the sidebar's list, which holds only the matches of a content search,
// and compared one spelling: an existing configuration was overwritten without a question.
describe('useFileActions import', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedService.save.mockResolvedValue({} as any);
        mockedService.delete.mockResolvedValue({} as any);
    });

    it('asks the server, and confirms over every file of the same configuration', async () => {
        mockedService.getAll.mockResolvedValue({ files: [{ name: 'org.example.yml.disabled' }, { name: 'Org.Example.cfg' }, { name: 'org.example-x.cfg' }] } as any);
        const { actions, setModalConfig } = setup();

        await actions.handleUploadFile(upload('org.example.cfg'));

        expect(mockedService.getAll).toHaveBeenCalledWith();
        expect(mockedService.save).not.toHaveBeenCalled();
        const config = setModalConfig.mock.calls[0][0];
        expect(config.type).toBe('confirm');
        expect(config.message).toBe('modal.conflict.message:{"name":"org.example.cfg","files":"org.example.yml.disabled, Org.Example.cfg"}');

        config.onConfirm();
        await waitFor(() => expect(mockedService.delete).toHaveBeenCalledTimes(1));
        expect(mockedService.save).toHaveBeenCalledWith(expect.objectContaining({ filename: 'org.example.cfg' }));
        // Org.Example.cfg is the same file on a case-insensitive disk: only the other one goes.
        expect(mockedService.delete).toHaveBeenCalledWith('org.example.yml.disabled');
    });

    it('imports straight away when nothing configures the same PID', async () => {
        mockedService.getAll.mockResolvedValue({ files: [{ name: 'org.other.cfg' }] } as any);
        const { actions, setModalConfig } = setup();

        await actions.handleUploadFile(upload('org.example.cfg'));

        await waitFor(() => expect(mockedService.save).toHaveBeenCalled());
        expect(setModalConfig).not.toHaveBeenCalled();
        expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it('does not import when the list cannot be read', async () => {
        mockedService.getAll.mockRejectedValue(new Error('offline'));
        const { actions } = setup();

        await actions.handleUploadFile(upload('org.example.cfg'));

        expect(mockedService.save).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalled();
    });

    // A name typed after Rename went straight to the save.
    it('checks a renamed file again', async () => {
        jest.useFakeTimers();
        mockedService.getAll.mockResolvedValue({ files: [{ name: 'org.example.cfg' }, { name: 'org.taken.yml' }] } as any);
        const { actions, setModalConfig } = setup();

        await actions.handleUploadFile(upload('org.example.cfg'));
        setModalConfig.mock.calls[0][0].onOther();
        jest.advanceTimersByTime(100);
        jest.useRealTimers();
        const prompt = setModalConfig.mock.calls[1][0];
        expect(prompt.type).toBe('prompt');

        prompt.onConfirm('org.taken.cfg');
        await waitFor(() => expect(setModalConfig).toHaveBeenCalledTimes(3));
        expect(setModalConfig.mock.calls[2][0].message).toContain('"files":"org.taken.yml"');
        expect(mockedService.save).not.toHaveBeenCalled();
    });
});
