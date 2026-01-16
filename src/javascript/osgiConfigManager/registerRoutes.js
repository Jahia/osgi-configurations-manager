import React from 'react';
import { registry } from '@jahia/ui-extender';
import App from './App';

export default function () {
    registry.add('adminRoute', 'osgi-configurations-manager', {
        targets: ['administration-server-configuration:99'],
        requiredPermission: 'canManageOsgiConfigurations',
        label: 'osgi-configurations-manager:label',
        icon: null,
        isSelectable: true,
        render: () => <App />
    });
}
