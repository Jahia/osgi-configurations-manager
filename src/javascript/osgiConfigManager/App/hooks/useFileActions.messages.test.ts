import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useFileActions } from './useFileActions';
import { osgiService } from '../api/osgiService';

jest.mock('../api/osgiService');
const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock('./useToast', () => ({
    useToast: () => ({ success: toastSuccess, error: toastError, warning: jest.fn() })
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

describe('useFileActions messages', () => {
    beforeEach(() => jest.clearAllMocks());

    // "Toggled status for x" did not say whether the configuration was now on or off.
    it('says which state the configuration reached', async () => {
        mockedService.toggle.mockResolvedValue({} as any);
        const { actions } = setup();

        await actions.toggleFileStatus({ name: 'org.example.cfg.disabled', enabled: false } as any);
        await actions.toggleFileStatus({ name: 'org.example.cfg', enabled: true } as any);

        expect(toastSuccess.mock.calls.map(([message]) => message)).toEqual([
            'notification.enableSuccess:{"name":"org.example.cfg"}',
            'notification.disableSuccess:{"name":"org.example.cfg"}'
        ]);
    });

    it('reports a failed import as an import, without a doubled full stop', async () => {
        mockedService.getAll.mockRejectedValue(new Error('Access denied.'));
        const { actions } = setup();

        await actions.handleUploadFile(new File(['a = b\n'], 'org.example.cfg'));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('modal.error.import:{"error":"Access denied"}'));
    });

    // The danger button of the delete dialog read "OK".
    it('names the delete confirmation after the action', () => {
        const { actions, setModalConfig } = setup();

        actions.handleDeleteFile({ name: 'org.example.cfg' } as any);

        expect(setModalConfig.mock.calls[0][0].confirmLabel).toBe('modal.deleteFile.confirm');
    });
});
