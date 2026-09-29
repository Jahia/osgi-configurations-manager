import { BUNDLED_LANGUAGES, NAMESPACE, loadBundledTranslations } from './bundledTranslations';
import fs from 'fs';
import en from '../main/resources/javascript/locales/en.json';

const fakeI18n = language => ({ language, resolvedLanguage: undefined, addResourceBundle: jest.fn() });

describe('loadBundledTranslations', () => {
    it('adds the translations of this build over the ones Jahia fetched, for the language and English', async () => {
        const i18n = fakeI18n('fr-FR');
        const importLocale = jest.fn(language => Promise.resolve({ default: { language } }));

        await loadBundledTranslations(i18n, importLocale);

        expect(importLocale.mock.calls.map(call => call[0]).sort()).toEqual(['en', 'fr']);
        // deep and overwrite: a stale file served by a CDN cannot win over the build.
        expect(i18n.addResourceBundle).toHaveBeenCalledWith('fr', NAMESPACE, { language: 'fr' }, true, true);
        expect(i18n.addResourceBundle).toHaveBeenCalledWith('en', NAMESPACE, { language: 'en' }, true, true);
    });

    it('loads English only for English, or for a language the module does not ship', async () => {
        for (const language of ['en', 'ja']) {
            const importLocale = jest.fn(() => Promise.resolve({}));
            await loadBundledTranslations(fakeI18n(language), importLocale);
            expect(importLocale.mock.calls).toEqual([['en']]);
        }
    });

    it('keeps what Jahia fetched when a chunk fails to load', async () => {
        const i18n = fakeI18n('de');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const importLocale = language => (language === 'de' ? Promise.reject(new Error('offline')) : Promise.resolve({}));

        await expect(loadBundledTranslations(i18n, importLocale)).resolves.toBeUndefined();

        expect(i18n.addResourceBundle).toHaveBeenCalledTimes(1);
        expect(i18n.addResourceBundle).toHaveBeenCalledWith('en', NAMESPACE, {}, true, true);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('imports the real locale files by default', async () => {
        const i18n = fakeI18n('en');
        await loadBundledTranslations(i18n);
        expect(i18n.addResourceBundle).toHaveBeenCalledWith('en', NAMESPACE, en, true, true);
        expect(en.editor.button.showSecrets).toBeTruthy();
    });

    it('lists every locale the module ships', () => {
        const shipped = fs.readdirSync(`${__dirname}/../main/resources/javascript/locales`)
            .filter(file => file.endsWith('.json')).map(file => file.replace('.json', '')).sort();
        expect([...BUNDLED_LANGUAGES].sort()).toEqual(shipped);
    });
});
