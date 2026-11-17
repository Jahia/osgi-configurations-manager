package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Constants;
import org.osgi.framework.ServiceReference;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;
import org.osgi.service.cm.ManagedService;
import org.osgi.service.cm.ManagedServiceFactory;
import org.osgi.service.component.runtime.ServiceComponentRuntime;
import org.osgi.service.component.runtime.dto.ComponentConfigurationDTO;
import org.osgi.service.component.runtime.dto.ComponentDescriptionDTO;
import org.osgi.service.metatype.MetaTypeInformation;
import org.osgi.service.metatype.MetaTypeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Which bundles use the configuration a file holds, read-only: the bundle the configuration is
 * bound to, the Declarative Services components that take it, the ManagedService(Factory) services
 * registered for it and the bundle providing its Metatype.
 *
 * <p>The PID comes from Configuration Admin when the file is loaded (its configuration carries the
 * file in {@code felix.fileinstall.filename}), otherwise from the name the way FileInstall reads it:
 * {@code <pid>~<name>} or {@code <pid>-<name>} is an instance of the factory {@code <pid>}, anything
 * else the singleton {@code <pid>}.
 *
 * <p>Each source is optional and fails on its own: a missing service or an error in one leaves the
 * others reported. Only symbolic names, versions, component names and PIDs leave this class, never a
 * bundle location, which can be an absolute server path.
 */
final class ConfigurationUsageLookup {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConfigurationUsageLookup.class);

    static final String BOUND = "BOUND";
    static final String COMPONENT = "COMPONENT";
    static final String MANAGED_SERVICE = "MANAGED_SERVICE";
    static final String MANAGED_SERVICE_FACTORY = "MANAGED_SERVICE_FACTORY";
    static final String METATYPE = "METATYPE";
    private static final List<String> KIND_ORDER =
            List.of(BOUND, COMPONENT, MANAGED_SERVICE, MANAGED_SERVICE_FACTORY, METATYPE);

    static final String STATE_DISABLED = "DISABLED";
    private static final String FILEINSTALL_FILENAME = "felix.fileinstall.filename";
    /** A location starting with this binds the configuration to a region of bundles, not to one bundle. */
    private static final String MULTI_LOCATION_PREFIX = "?";

    private final BundleContext context;
    private final ConfigurationAdmin configurationAdmin;
    private final ServiceComponentRuntime serviceComponentRuntime;
    private final MetaTypeService metaTypeService;

    ConfigurationUsageLookup(BundleContext context, ConfigurationAdmin configurationAdmin,
                             ServiceComponentRuntime serviceComponentRuntime, MetaTypeService metaTypeService) {
        this.context = context;
        this.configurationAdmin = configurationAdmin;
        this.serviceComponentRuntime = serviceComponentRuntime;
        this.metaTypeService = metaTypeService;
    }

    /** What a file configures: a singleton PID or a factory PID, and the configurations it is loaded as. */
    static final class Target {
        final String pid;
        final String factoryPid;
        final List<Loaded> configurations;

        Target(String pid, String factoryPid, List<Loaded> configurations) {
            this.pid = pid;
            this.factoryPid = factoryPid;
            this.configurations = configurations;
        }
    }

    /**
     * One configuration as it was when read. Configuration Admin throws IllegalStateException from
     * every getter of a configuration deleted meanwhile (a file removed during the lookup), so each
     * value is read once, and a configuration that is gone is left out rather than failing the call.
     */
    static final class Loaded {
        final String pid;
        final String factoryPid;
        final String location;

        private Loaded(String pid, String factoryPid, String location) {
            this.pid = pid;
            this.factoryPid = factoryPid;
            this.location = location;
        }

        static Loaded read(Configuration configuration) {
            try {
                return new Loaded(configuration.getPid(), configuration.getFactoryPid(), configuration.getBundleLocation());
            } catch (RuntimeException e) {
                LOGGER.debug("Skipping a configuration deleted, or not readable, during the lookup", e);
                return null;
            }
        }
    }

    /**
     * The bundles using the configuration of {@code filename}, sorted by symbolic name. Each entry
     * has {@code symbolicName}, {@code name}, {@code version} and {@code usages}, a list of
     * {@code kind}, {@code detail} (component name or PID) and {@code states} (components only).
     *
     * @param filename     the validated file name
     * @param baseName     the file name without its extension and {@code .disabled}
     */
    List<Map<String, Object>> find(String filename, String baseName) {
        return find(resolveTarget(filename, baseName));
    }

    /** As {@link #find(String, String)}, for a target already resolved (and authorized) by the caller. */
    List<Map<String, Object>> find(Target target) {
        Map<Long, Map<String, Object>> byBundle = new LinkedHashMap<>();
        Bundle[] bundles = context.getBundles();

        collectBound(target, bundles, byBundle);
        collectComponents(target, byBundle);
        collectManagedServices(target, byBundle);
        collectMetatype(target, bundles, byBundle);

        List<Map<String, Object>> result = new ArrayList<>(byBundle.values());
        for (Map<String, Object> entry : result) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> usages = (List<Map<String, Object>>) entry.get("usages");
            usages.sort(Comparator.comparingInt(usage -> KIND_ORDER.indexOf((String) usage.get("kind"))));
        }
        result.sort(Comparator.comparing((Map<String, Object> entry) -> String.valueOf(entry.get("symbolicName")))
                .thenComparing(entry -> String.valueOf(entry.get("version"))));
        return result;
    }

    Target resolveTarget(String filename, String baseName) {
        List<Loaded> loaded = listConfigurations(
                "(" + FILEINSTALL_FILENAME + "=*/" + escapeFilterValue(filename) + ")");
        if (!loaded.isEmpty()) {
            Loaded configuration = loaded.get(0);
            return new Target(configuration.factoryPid == null ? configuration.pid : null, configuration.factoryPid, loaded);
        }

        // Not loaded (a .disabled file, or not picked up yet): read the name as FileInstall does.
        int separator = baseName.indexOf('~');
        if (separator < 0) {
            separator = baseName.indexOf('-');
        }
        if (separator > 0) {
            return new Target(null, baseName.substring(0, separator), List.of());
        }
        return new Target(baseName, null,
                listConfigurations("(" + Constants.SERVICE_PID + "=" + escapeFilterValue(baseName) + ")"));
    }

    private void collectBound(Target target, Bundle[] bundles, Map<Long, Map<String, Object>> byBundle) {
        if (bundles == null) {
            return;
        }
        for (Loaded configuration : target.configurations) {
            String location = configuration.location;
            // Null: not bound yet. A multi-location ("?region") is open to any bundle of that region.
            if (location == null || location.startsWith(MULTI_LOCATION_PREFIX)) {
                continue;
            }
            for (Bundle bundle : bundles) {
                if (location.equals(bundle.getLocation())) {
                    addUsage(byBundle, bundle, BOUND, configuration.pid, null);
                }
            }
        }
    }

    private void collectComponents(Target target, Map<Long, Map<String, Object>> byBundle) {
        if (serviceComponentRuntime == null) {
            return;
        }
        try {
            for (ComponentDescriptionDTO description : serviceComponentRuntime.getComponentDescriptionDTOs()) {
                if (description.bundle == null || !takesTarget(description.configurationPid, target)) {
                    continue;
                }
                Bundle bundle = context.getBundle(description.bundle.id);
                if (bundle != null) {
                    addUsage(byBundle, bundle, COMPONENT, description.name, componentStates(description, target));
                }
            }
        } catch (RuntimeException e) {
            LOGGER.debug("Unable to inspect Declarative Services components", e);
        }
    }

    private static boolean takesTarget(String[] configurationPids, Target target) {
        if (configurationPids == null) {
            return false;
        }
        for (String configurationPid : configurationPids) {
            if (configurationPid != null
                    && (configurationPid.equals(target.pid) || configurationPid.equals(target.factoryPid))) {
                return true;
            }
        }
        return false;
    }

    /**
     * The states of the component's configurations, sorted. For a factory instance, only the
     * component configuration created from that instance, and none when it has none (a .disabled or
     * not yet loaded file): the other instances' states belong to other files, which may be hidden.
     */
    private List<String> componentStates(ComponentDescriptionDTO description, Target target) {
        if (!serviceComponentRuntime.isComponentEnabled(description)) {
            return List.of(STATE_DISABLED);
        }
        Collection<ComponentConfigurationDTO> configurations =
                serviceComponentRuntime.getComponentConfigurationDTOs(description);
        if (configurations == null) {
            return List.of();
        }
        Set<String> instancePids = new LinkedHashSet<>();
        if (target.factoryPid != null) {
            target.configurations.forEach(configuration -> instancePids.add(configuration.pid));
        }
        Set<String> states = new TreeSet<>();
        Set<String> instanceStates = new TreeSet<>();
        for (ComponentConfigurationDTO configuration : configurations) {
            String state = stateName(configuration.state);
            states.add(state);
            if (servicePids(configuration).stream().anyMatch(instancePids::contains)) {
                instanceStates.add(state);
            }
        }
        return new ArrayList<>(target.factoryPid != null ? instanceStates : states);
    }

    private static Collection<String> servicePids(ComponentConfigurationDTO configuration) {
        Object value = configuration.properties == null ? null : configuration.properties.get(Constants.SERVICE_PID);
        return toStrings(value);
    }

    static String stateName(int state) {
        switch (state) {
            case ComponentConfigurationDTO.UNSATISFIED_CONFIGURATION:
                return "UNSATISFIED_CONFIGURATION";
            case ComponentConfigurationDTO.UNSATISFIED_REFERENCE:
                return "UNSATISFIED_REFERENCE";
            case ComponentConfigurationDTO.SATISFIED:
                return "SATISFIED";
            case ComponentConfigurationDTO.ACTIVE:
                return "ACTIVE";
            case ComponentConfigurationDTO.FAILED_ACTIVATION:
                return "FAILED_ACTIVATION";
            default:
                return "UNKNOWN";
        }
    }

    private void collectManagedServices(Target target, Map<Long, Map<String, Object>> byBundle) {
        if (target.pid != null) {
            collectServices(ManagedService.class.getName(), target.pid, MANAGED_SERVICE, byBundle);
        }
        if (target.factoryPid != null) {
            collectServices(ManagedServiceFactory.class.getName(), target.factoryPid, MANAGED_SERVICE_FACTORY, byBundle);
        }
    }

    private void collectServices(String className, String pid, String kind, Map<Long, Map<String, Object>> byBundle) {
        try {
            // All references, not only those of our class space: a bundle wired to another
            // version of org.osgi.service.cm still receives the configuration.
            ServiceReference<?>[] references = context.getAllServiceReferences(className,
                    "(" + Constants.SERVICE_PID + "=" + escapeFilterValue(pid) + ")");
            if (references == null) {
                return;
            }
            for (ServiceReference<?> reference : references) {
                Bundle bundle = reference.getBundle();
                if (bundle != null) {
                    addUsage(byBundle, bundle, kind, pid, null);
                }
            }
        } catch (Exception e) {
            LOGGER.debug("Unable to inspect {} registrations for {}", className, pid, e);
        }
    }

    private void collectMetatype(Target target, Bundle[] bundles, Map<Long, Map<String, Object>> byBundle) {
        if (metaTypeService == null || bundles == null) {
            return;
        }
        for (Bundle bundle : bundles) {
            if (bundle == null || bundle.getState() < Bundle.STARTING) {
                continue;
            }
            try {
                MetaTypeInformation information = metaTypeService.getMetaTypeInformation(bundle);
                if (information == null) {
                    continue;
                }
                if (target.pid != null && contains(information.getPids(), target.pid)) {
                    addUsage(byBundle, bundle, METATYPE, target.pid, null);
                }
                // A factory instance is described by a factory definition, or by a plain one that a
                // ManagedServiceFactory serves (the manager offers those as factories too).
                if (target.factoryPid != null && (contains(information.getFactoryPids(), target.factoryPid)
                        || contains(information.getPids(), target.factoryPid))) {
                    addUsage(byBundle, bundle, METATYPE, target.factoryPid, null);
                }
            } catch (RuntimeException e) {
                LOGGER.debug("Unable to inspect metatype information for bundle {}", bundle.getSymbolicName(), e);
            }
        }
    }

    private List<Loaded> listConfigurations(String filter) {
        if (configurationAdmin == null) {
            return List.of();
        }
        try {
            Configuration[] configurations = configurationAdmin.listConfigurations(filter);
            if (configurations == null) {
                return List.of();
            }
            List<Loaded> loaded = new ArrayList<>();
            for (Configuration configuration : configurations) {
                Loaded read = Loaded.read(configuration);
                if (read != null) {
                    loaded.add(read);
                }
            }
            return loaded;
        } catch (Exception e) {
            LOGGER.debug("Unable to list configurations matching {}", filter, e);
            return List.of();
        }
    }

    private static void addUsage(Map<Long, Map<String, Object>> byBundle, Bundle bundle, String kind, String detail,
                                 List<String> states) {
        Map<String, Object> entry = byBundle.computeIfAbsent(bundle.getBundleId(), id -> {
            Map<String, Object> created = new LinkedHashMap<>();
            created.put("symbolicName", bundle.getSymbolicName());
            created.put("name", bundleName(bundle));
            created.put("version", String.valueOf(bundle.getVersion()));
            created.put("usages", new ArrayList<Map<String, Object>>());
            return created;
        });
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> usages = (List<Map<String, Object>>) entry.get("usages");
        boolean known = usages.stream()
                .anyMatch(usage -> kind.equals(usage.get("kind")) && String.valueOf(detail).equals(String.valueOf(usage.get("detail"))));
        if (known) {
            return;
        }
        Map<String, Object> usage = new LinkedHashMap<>();
        usage.put("kind", kind);
        usage.put("detail", detail);
        usage.put("states", states == null ? List.of() : states);
        usages.add(usage);
    }

    private static String bundleName(Bundle bundle) {
        String name = bundle.getHeaders() == null ? null : bundle.getHeaders().get(Constants.BUNDLE_NAME);
        return name == null || name.isBlank() ? bundle.getSymbolicName() : name;
    }

    private static boolean contains(String[] values, String value) {
        return values != null && Arrays.asList(values).contains(value);
    }

    private static Collection<String> toStrings(Object value) {
        List<String> strings = new ArrayList<>();
        if (value instanceof String) {
            strings.add((String) value);
        } else if (value instanceof String[]) {
            strings.addAll(Arrays.asList((String[]) value));
        } else if (value instanceof Collection<?>) {
            ((Collection<?>) value).stream().filter(String.class::isInstance).map(String.class::cast).forEach(strings::add);
        }
        return strings;
    }

    /** RFC 1960 escaping of a filter value: the file name is the caller's input. */
    static String escapeFilterValue(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (char character : value.toCharArray()) {
            if (character == '\\' || character == '*' || character == '(' || character == ')') {
                escaped.append('\\');
            }
            escaped.append(character);
        }
        return escaped.toString();
    }
}
