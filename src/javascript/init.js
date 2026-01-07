import { registry } from '@jahia/ui-extender';
import registrations from './osgiConfigManager/registerRoutes';
import i18next from 'i18next';

export default function () {
    registry.add('callback', 'osgi-configurations-manager', {
        targets: ['jahiaApp-init:50'],
        callback: async () => {
            await i18next.loadNamespaces('osgi-configurations-manager');
            registrations();
            console.debug('%c OSGi Configurations Manager routes have been registered', 'color: #3c8cba');
        }
    });
}
