import { renderHook, act } from '@testing-library/react-hooks';
import { useProperties } from './useProperties';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

// Characterization tests for the visual-editor property hook (duplicate-key guard,
// reorder, delete, encryption toggle, cfg-entry insertion). These lock current
// behaviour ahead of the visual-editor / encryption refactors.

describe('useProperties', () => {
    test('handleAddProperty rejects a duplicate key via onError and adds a new one', () => {
        const { result } = renderHook(() => useProperties());

        act(() => result.current.resetProperties({ _order: ['existing'], existing: { value: '1', isLeaf: true } }));

        const onError = jest.fn();
        act(() => result.current.handleAddProperty([], 'existing', onError));
        expect(onError).toHaveBeenCalledWith('modal.error.propertyExists');

        const onError2 = jest.fn();
        act(() => result.current.handleAddProperty([], 'fresh', onError2));
        expect(onError2).not.toHaveBeenCalled();
        expect(result.current.properties.fresh).toBeDefined();
        expect(result.current.properties._order).toContain('fresh');
    });

    test('handleToggleEncryption flips the encrypted flag of a leaf', () => {
        const { result } = renderHook(() => useProperties());

        act(() => result.current.resetProperties([
            { type: { value: 'property' }, key: { value: 'k' }, value: { value: 'v', isLeaf: true, encrypted: false } }
        ]));

        act(() => result.current.handleToggleEncryption([0, 'value'], false));

        expect(result.current.properties[0].value.encrypted).toBe(true);
    });

    test('handleReorder moves an entry from one index to another', () => {
        const { result } = renderHook(() => useProperties());

        act(() => result.current.resetProperties([{ id: 'A' }, { id: 'B' }, { id: 'C' }]));

        act(() => result.current.handleReorder(0, 2));

        expect(result.current.properties.map((e: any) => e.id)).toEqual(['B', 'C', 'A']);
    });

    test('handleDeleteProperty removes an array entry by index', () => {
        const { result } = renderHook(() => useProperties());

        act(() => result.current.resetProperties([{ id: 'X' }, { id: 'Y' }]));

        act(() => result.current.handleDeleteProperty([1]));

        expect(result.current.properties).toHaveLength(1);
        expect(result.current.properties[0].id).toBe('X');
    });

    test('handleAddCfgEntry inserts a wrapped entry at the given index', () => {
        const { result } = renderHook(() => useProperties());

        act(() => result.current.resetProperties([]));

        act(() => result.current.handleAddCfgEntry({ type: 'comment', value: '# inserted' }, 0));

        expect(result.current.properties[0].type.value).toBe('comment');
        expect(result.current.properties[0].value.value).toBe('# inserted');
    });
});
