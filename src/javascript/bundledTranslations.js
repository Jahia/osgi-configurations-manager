import i18next from 'i18next';

export const NAMESPACE = 'osgi-configurations-manager';

/** The languages the module ships, in src/main/resources/javascript/locales. */
export const BUNDLED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt'];

/**
 * Loads the translations built with this version of the interface, over the ones Jahia fetched.
 *
 * Jahia fetches the namespace from /modules/osgi-configurations-manager/javascript/locales/<lng>.json,
 * a URL that is the same in every version. A CDN in front of Jahia can keep the file of the former
 * version while the JavaScript, whose file names carry a hash, is already the new one: the new
 * labels then show as their keys. Imported here, each locale becomes a chunk named after its content
 * hash, so the translations always come with the code that uses them.
 *
 * Only the user's language and English (the fallback) are loaded. A chunk that fails to load leaves
 * the translations Jahia fetched in place.
 */
export const loadBundledTranslations = async (i18n = i18next, importLocale = defaultImportLocale) => {
    const current = String(i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
    const languages = [...new Set([current, 'en'])].filter(language => BUNDLED_LANGUAGES.includes(language));
    await Promise.all(languages.map(async language => {
        try {
            const module = await importLocale(language);
            i18n.addResourceBundle(language, NAMESPACE, module.default || module, true, true);
        } catch (e) {
            console.warn(`OSGi Configurations Manager: the ${language} translations of this version could not be loaded`, e);
        }
    }));
};

const defaultImportLocale = language => import(
    /* webpackChunkName: "locale-[request]" */
    `../main/resources/javascript/locales/${language}.json`
);
