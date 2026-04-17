export const formatDefaultValue = property => {
    const defaultValues = Array.isArray(property?.defaultValues) ? property.defaultValues.filter(Boolean) : [];
    return defaultValues.join(', ');
};

export const getPropertyLabel = property => property?.name || property?.id || '';

export const matchesMetatypePropertyQuery = (property, query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    const searchableValues = [
        property?.id,
        property?.name,
        ...(Array.isArray(property?.defaultValues) ? property.defaultValues : []),
        ...(Array.isArray(property?.options)
            ? property.options.reduce((acc, option) => {
                acc.push(option?.value, option?.label);
                return acc;
            }, [])
            : [])
    ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());

    return searchableValues.some(value => value.includes(normalizedQuery));
};

export const findExactMetatypePropertyMatch = (properties, query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery || !Array.isArray(properties)) {
        return null;
    }

    return properties.find(property => {
        const id = String(property?.id || '').trim().toLowerCase();
        const name = String(property?.name || '').trim().toLowerCase();
        return id === normalizedQuery || name === normalizedQuery;
    }) || null;
};

export const getLocalizedTypeLabel = (type, t) => {
    if (!type) {
        return '';
    }

    return t(`editor.metatype.suggestion.types.${type}`, {defaultValue: type});
};

export const buildPropertyDocumentation = (property, t, options = {}) => {
    const {includeHeader = true} = options;
    const sections = [];

    if (includeHeader) {
        sections.push(`**${getPropertyLabel(property)}**`);

        if (property?.id && property.name && property.name !== property.id) {
            sections.push(`\`${property.id}\``);
        } else if (property?.id) {
            sections.push(`\`${property.id}\``);
        }
    }

    if (property?.description) {
        sections.push(property.description);
    }

    const details = [];
    if (property?.type) {
        details.push(`${t('editor.metatype.type')}: \`${property.type}\``);
    }
    details.push(`${t('editor.metatype.optional')}: ${property?.optional ? t('editor.metatype.yes') : t('editor.metatype.no')}`);

    const defaultValue = formatDefaultValue(property);
    if (defaultValue) {
        details.push(`${t('editor.metatype.default')}: \`${defaultValue}\``);
    }

    if (details.length > 0) {
        sections.push(details.join('\n\n'));
    }

    if (Array.isArray(property?.options) && property.options.length > 0) {
        sections.push([
            `${t('editor.metatype.values')}:`,
            ...property.options.map(option => `- \`${option.value}\`${option.label && option.label !== option.value ? `: ${option.label}` : ''}`)
        ].join('\n'));
    }

    return sections.join('\n\n');
};

export const getSuggestedPropertyValue = property => {
    const defaultValue = formatDefaultValue(property);
    if (defaultValue) {
        return defaultValue;
    }

    if (Array.isArray(property?.options) && property.options.length === 1) {
        return property.options[0].value || '';
    }

    return '';
};
