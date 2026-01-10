import { useState } from 'react';
import { updateStateDeep } from '../utils/configUtils';
import { useTranslation } from 'react-i18next';
// import { osgiService } from '../api/osgiService';
export const useProperties = () => {
    const { t } = useTranslation('osgi-configurations-manager');
    const [properties, setProperties] = useState<any>({});
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

    // Helper to deeply update state
    const updateProp = (path: (string | number)[], field: string, val: any) => {
        setProperties((prev: any) => updateStateDeep(prev, 0, path, field, val));
    };

    const handlePropUpdate = (path: (string | number)[], field: string, val: any) => {
        updateProp(path, field, val);
    };

    const handleAddProperty = (path: (string | number)[], key: string, onError: (msg: string) => void) => {
        if (!key) return;

        let target = properties;
        for (const part of path) {
            target = target?.[part];
        }

        if (target && Object.prototype.hasOwnProperty.call(target, key)) {
            onError(t('modal.error.propertyExists', { name: key }));
            return;
        }

        setProperties((prev: any) => updateStateDeep(prev, 0, [...path, key], 'value', '', true));
    };

    const handleAddItem = (path: (string | number)[], val?: string) => {
        setProperties((prev: any) => {
            let curr = prev;
            for (let i = 0; i < path.length; i++) {
                curr = curr[path[i]];
            }
            const nextIdx = Array.isArray(curr) ? curr.length : 0;
            return updateStateDeep(prev, 0, [...path, nextIdx], 'value', val || '', true);
        });
    };

    const handleDeleteProperty = (path: (string | number)[]) => {
        const key = path[path.length - 1];

        setProperties((prev: any) => {
            if (Array.isArray(prev)) {
                const newArr = [...prev];
                if (typeof key === 'number') {
                    newArr.splice(key, 1);
                }
                return newArr;
            }

            const next = { ...prev };
            let curr = next;
            for (let i = 0; i < path.length - 1; i++) {
                curr = curr[path[i]];
            }
            const lastKey = path[path.length - 1];
            delete curr[lastKey];
            if (curr._order) {
                // @ts-ignore
                curr._order = curr._order.filter(k => k !== lastKey);
            }
            return next;
        });
    };

    const handleAddCfgEntry = (entry: any, index: number) => {
        setProperties((prev: any) => {
            if (Array.isArray(prev)) {
                const newEntry: any = {};
                Object.keys(entry).forEach(k => {
                    newEntry[k] = { value: entry[k], isLeaf: true };
                });

                const newArr = [...prev];
                if (typeof index === 'number' && index >= 0 && index <= newArr.length) {
                    newArr.splice(index, 0, newEntry);
                } else {
                    newArr.push(newEntry);
                }
                return newArr;
            }
            return prev;
        });
    };

    const handleReorder = (fromIndex: number, toIndex: number) => {
        setProperties((prev: any) => {
            if (Array.isArray(prev)) {
                const newArr = [...prev];
                const [movedItem] = newArr.splice(fromIndex, 1);
                newArr.splice(toIndex, 0, movedItem);
                return newArr;
            }
            return prev;
        });
    };

    const toggleCollapse = (keyString: string) => {
        setCollapsedPaths(prev => {
            const next = new Set(prev);
            if (next.has(keyString)) next.delete(keyString);
            else next.add(keyString);
            return next;
        });
    };

    const resetProperties = (newProps: any) => {
        setProperties(newProps);
        setCollapsedPaths(new Set());
    };

    const handleToggleEncryption = (path: (string | number)[], currentEncrypted: boolean) => {
        // Sync Toggle: Just flip the flag in state. 
        // No values are changed (we keep cleartext in memory).
        // Encryption happens on save/export.
        const targetEncrypted = !currentEncrypted;

        setProperties((prev: any) => {
            return updateStateDeep(prev, 0, path, 'encrypted', targetEncrypted);
        });
    };


    return {
        properties,
        setProperties, // Exposed for raw updates if needed, though specific handlers are preferred
        collapsedPaths,
        handlePropUpdate,
        handleAddProperty,
        handleAddItem,
        handleDeleteProperty,
        handleAddCfgEntry,
        handleReorder,
        toggleCollapse,
        resetProperties,
        handleToggleEncryption
    };
};
