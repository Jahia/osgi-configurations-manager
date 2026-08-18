const fs = require('fs');
const path = require('path');

// Guards against the locale drift found in review: every locale must expose the exact same key
// set as the English reference, with no empty translations. Run by `yarn test`.

const LOCALES_DIR = path.join(__dirname, '../../../main/resources/javascript/locales');
const REFERENCE = 'en';
const LOCALES = ['en', 'fr', 'de', 'it', 'es', 'pt'];

const flatten = (obj, prefix = '') =>
    Object.entries(obj).reduce((acc, [k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(acc, flatten(v, key));
        } else {
            acc[key] = v;
        }
        return acc;
    }, {});

const load = (locale) => flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8')));

describe('i18n locale parity', () => {
    const referenceKeys = Object.keys(load(REFERENCE)).sort();
    const others = LOCALES.filter((l) => l !== REFERENCE);

    it.each(others)('%s exposes exactly the reference key set', (locale) => {
        const keys = Object.keys(load(locale)).sort();
        const missing = referenceKeys.filter((k) => !keys.includes(k));
        const extra = keys.filter((k) => !referenceKeys.includes(k));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it.each(LOCALES)('%s has no empty translation values', (locale) => {
        const empty = Object.entries(load(locale))
            .filter(([, v]) => v === '' || v === null || v === undefined)
            .map(([k]) => k);
        expect(empty).toEqual([]);
    });
});
