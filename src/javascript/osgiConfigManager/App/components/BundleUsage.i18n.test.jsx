import React from 'react';
import {render, screen} from '@testing-library/react';
import i18next from 'i18next';
import {I18nextProvider, initReactI18next} from 'react-i18next';
import en from '../../../../main/resources/javascript/locales/en.json';
import {BundleUsage} from './BundleUsage';
import {osgiService} from '../api/osgiService';

jest.mock('../api/osgiService', () => ({
    osgiService: {getBundleUsage: jest.fn()}
}));

// With the real i18next, which escapes interpolated values for HTML by default: React escapes the
// text again, so a name carrying &, <, ' or / showed as an entity (a.B&amp;C&#x2F;D).
describe('BundleUsage with the real translations', () => {
    let i18n;

    beforeAll(async () => {
        i18n = i18next.createInstance();
        await i18n.use(initReactI18next).init({
            lng: 'en',
            ns: ['osgi-configurations-manager'],
            defaultNS: 'osgi-configurations-manager',
            resources: {en: {'osgi-configurations-manager': en}}
        });
    });

    it('shows component names and versions as they are', async () => {
        osgiService.getBundleUsage.mockResolvedValue([{
            symbolicName: 'org.example', name: 'Example', version: '1.0.0.A&B',
            usages: [
                {kind: 'COMPONENT', detail: "a.B&C/D<'x'>", states: ['ACTIVE']},
                {kind: 'COMPONENT', detail: 'a.E&F/G', states: []}
            ]
        }]);

        render(<I18nextProvider i18n={i18n}><BundleUsage fileName="org.example.cfg"/></I18nextProvider>);

        const item = await screen.findByRole('listitem');
        expect(item.textContent).toBe(
            "Example (org.example) version 1.0.0.A&B — component a.B&C/D<'x'> (active), component a.E&F/G");
    });
});
