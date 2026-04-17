import { findExactMetatypePropertyMatch, matchesMetatypePropertyQuery } from './metatypeUtils';

describe('matchesMetatypePropertyQuery', () => {
    const property = {
        id: 'ldap.url',
        name: 'LDAP URL',
        description: 'Connection endpoint used by the LDAP connector',
        type: 'String',
        defaultValues: ['ldap://localhost:389'],
        options: [
            { value: 'ldap://localhost:389', label: 'Local LDAP' }
        ]
    };

    it('matches on the property id', () => {
        expect(matchesMetatypePropertyQuery(property, 'ldap.url')).toBe(true);
    });

    it('matches on the display name', () => {
        expect(matchesMetatypePropertyQuery(property, 'ldap url')).toBe(true);
    });

    it('matches on option values', () => {
        expect(matchesMetatypePropertyQuery(property, 'local ldap')).toBe(true);
    });

    it('does not match description-only terms', () => {
        expect(matchesMetatypePropertyQuery(property, 'connector')).toBe(false);
    });

    it('finds an exact match by id or name', () => {
        expect(findExactMetatypePropertyMatch([property], 'ldap.url')).toBe(property);
        expect(findExactMetatypePropertyMatch([property], 'ldap url')).toBe(property);
        expect(findExactMetatypePropertyMatch([property], 'ldap')).toBeNull();
    });
});
