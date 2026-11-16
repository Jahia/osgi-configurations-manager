import { findKeyProblems } from './configUtils';

const prop = (key: string, value = 'v') => ({ type: { value: 'property' }, key: { value: key }, value: { value } });

describe('findKeyProblems', () => {
    test('reports nothing for distinct keys, comments and empty lines', () => {
        expect(findKeyProblems([prop('a'), { type: 'comment', value: '# x' }, { type: 'empty' }, prop('b')])).toEqual({});
    });

    // A blank key was saved as " = value", with no warning.
    test('reports a blank or whitespace-only key', () => {
        expect(findKeyProblems([prop('a'), prop(''), prop('   ')])).toEqual({ 1: 'empty', 2: 'empty' });
    });

    test('reports every occurrence of a duplicate key, compared trimmed', () => {
        expect(findKeyProblems([prop('a'), prop('b'), prop('a '), prop('c')])).toEqual({ 0: 'duplicate', 2: 'duplicate' });
    });

    // Configuration Admin keys are case-insensitive: Felix refuses Name and name together.
    test('compares keys regardless of case', () => {
        expect(findKeyProblems([prop('Name'), prop('name')])).toEqual({ 0: 'duplicate', 1: 'duplicate' });
    });

    test('accepts a missing list', () => {
        expect(findKeyProblems(undefined)).toEqual({});
    });
});
