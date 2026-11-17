package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceReference;
import org.osgi.framework.Version;
import org.osgi.framework.dto.BundleDTO;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;
import org.osgi.service.cm.ManagedService;
import org.osgi.service.cm.ManagedServiceFactory;
import org.osgi.service.component.runtime.ServiceComponentRuntime;
import org.osgi.service.component.runtime.dto.ComponentConfigurationDTO;
import org.osgi.service.component.runtime.dto.ComponentDescriptionDTO;
import org.osgi.service.metatype.MetaTypeInformation;
import org.osgi.service.metatype.MetaTypeService;

import java.util.Hashtable;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Which bundles use a configuration: bound location, DS components, ManagedService(Factory)
 * registrations and Metatype providers, each reported with the bundle's symbolic name and version.
 */
class ConfigurationUsageLookupTest {

    private static final String PID = "org.example.mail";
    private static final String FILE = PID + ".cfg";
    private static final String LOADED_FILTER = "(felix.fileinstall.filename=*/" + FILE + ")";

    private BundleContext context;
    private ConfigurationAdmin configurationAdmin;
    private ServiceComponentRuntime runtime;
    private MetaTypeService metaTypeService;
    private Bundle mailBundle;
    private Bundle otherBundle;

    @BeforeEach
    void setUp() {
        context = mock(BundleContext.class);
        configurationAdmin = mock(ConfigurationAdmin.class);
        runtime = mock(ServiceComponentRuntime.class);
        metaTypeService = mock(MetaTypeService.class);
        mailBundle = bundle(12, "org.example.mail.impl", "2.4.1", "mvn:org.example/mail/2.4.1");
        otherBundle = bundle(13, "org.example.other", "1.0.0", "mvn:org.example/other/1.0.0");
        when(context.getBundles()).thenReturn(new Bundle[] {mailBundle, otherBundle});
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of());
    }

    private Bundle bundle(long id, String symbolicName, String version, String location) {
        Bundle bundle = mock(Bundle.class);
        when(bundle.getBundleId()).thenReturn(id);
        when(bundle.getSymbolicName()).thenReturn(symbolicName);
        when(bundle.getVersion()).thenReturn(Version.parseVersion(version));
        when(bundle.getLocation()).thenReturn(location);
        when(bundle.getState()).thenReturn(Bundle.ACTIVE);
        when(context.getBundle(id)).thenReturn(bundle);
        return bundle;
    }

    private static Configuration configuration(String pid, String factoryPid, String location) {
        Configuration configuration = mock(Configuration.class);
        when(configuration.getPid()).thenReturn(pid);
        when(configuration.getFactoryPid()).thenReturn(factoryPid);
        when(configuration.getBundleLocation()).thenReturn(location);
        return configuration;
    }

    private void givenLoaded(String filter, String pid, String factoryPid, String location) throws Exception {
        Configuration loaded = configuration(pid, factoryPid, location);
        when(configurationAdmin.listConfigurations(filter)).thenReturn(new Configuration[] {loaded});
    }

    private ComponentDescriptionDTO component(String name, Bundle owner, String... configurationPids) {
        ComponentDescriptionDTO description = new ComponentDescriptionDTO();
        description.name = name;
        description.configurationPid = configurationPids;
        description.bundle = new BundleDTO();
        description.bundle.id = owner.getBundleId();
        return description;
    }

    private static ComponentConfigurationDTO componentConfiguration(int state, String servicePid) {
        ComponentConfigurationDTO configuration = new ComponentConfigurationDTO();
        configuration.state = state;
        configuration.properties = servicePid == null ? Map.of() : Map.of("service.pid", servicePid);
        return configuration;
    }

    private List<Map<String, Object>> find(String filename, String baseName) {
        return new ConfigurationUsageLookup(context, configurationAdmin, runtime, metaTypeService).find(filename, baseName);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> usages(Map<String, Object> entry) {
        return (List<Map<String, Object>>) entry.get("usages");
    }

    @Test
    @DisplayName("bound: the loaded configuration's location names the bundle, with its version")
    void reportsTheBoundBundle() throws Exception {
        givenLoaded(LOADED_FILTER, PID, null, "mvn:org.example/mail/2.4.1");

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(1, result.size());
        Map<String, Object> entry = result.get(0);
        assertEquals("org.example.mail.impl", entry.get("symbolicName"));
        assertEquals("org.example.mail.impl", entry.get("name"), "no Bundle-Name: the symbolic name stands in");
        assertEquals("2.4.1", entry.get("version"));
        assertEquals(List.of(Map.of("kind", "BOUND", "detail", PID, "states", List.of())), usages(entry));
        assertTrue(!entry.containsKey("location"), "a location can be a server path and never leaves the lookup");
    }

    @Test
    @DisplayName("multi-location: a '?' binding opens the configuration to a region, it names no bundle")
    void ignoresMultiLocationBinding() throws Exception {
        // Even a bundle whose location is the same string is not "the" bound bundle.
        Bundle regionLike = bundle(14, "org.example.region", "1.0.0", "?org.example.region");
        when(context.getBundles()).thenReturn(new Bundle[] {mailBundle, regionLike});
        givenLoaded(LOADED_FILTER, PID, null, "?org.example.region");

        assertTrue(find(FILE, PID).isEmpty());
    }

    @Test
    @DisplayName("bound: an unbound configuration names no bundle")
    void ignoresUnboundConfiguration() throws Exception {
        givenLoaded(LOADED_FILTER, PID, null, null);

        assertTrue(find(FILE, PID).isEmpty());
    }

    @Test
    @DisplayName("DS: a component whose configurationPid includes the PID, with its state")
    void reportsDeclarativeServicesComponent() {
        ComponentDescriptionDTO mailer = component("org.example.mail.Mailer", mailBundle, "org.example.base", PID);
        ComponentDescriptionDTO unrelated = component("org.example.Other", otherBundle, "org.example.other");
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of(mailer, unrelated));
        when(runtime.isComponentEnabled(mailer)).thenReturn(true);
        when(runtime.getComponentConfigurationDTOs(mailer))
                .thenReturn(List.of(componentConfiguration(ComponentConfigurationDTO.ACTIVE, PID)));

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(1, result.size());
        assertEquals("org.example.mail.impl", result.get(0).get("symbolicName"));
        assertEquals("2.4.1", result.get(0).get("version"));
        assertEquals(List.of(Map.of("kind", "COMPONENT", "detail", "org.example.mail.Mailer", "states", List.of("ACTIVE"))),
                usages(result.get(0)));
    }

    @Test
    @DisplayName("DS: a disabled component is reported as DISABLED")
    void reportsDisabledComponent() {
        ComponentDescriptionDTO mailer = component("org.example.mail.Mailer", mailBundle, PID);
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of(mailer));
        when(runtime.isComponentEnabled(mailer)).thenReturn(false);

        assertEquals(List.of("DISABLED"), usages(find(FILE, PID).get(0)).get(0).get("states"));
    }

    @Test
    @DisplayName("DS factory: a <pid>~<name> instance matches the factory PID and keeps only its own state")
    void reportsFactoryComponentForTheInstance() throws Exception {
        String instanceFile = PID + "~smtp.cfg";
        givenLoaded("(felix.fileinstall.filename=*/" + instanceFile + ")", PID + "~smtp", PID, null);
        ComponentDescriptionDTO mailer = component("org.example.mail.Mailer", mailBundle, PID);
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of(mailer));
        when(runtime.isComponentEnabled(mailer)).thenReturn(true);
        when(runtime.getComponentConfigurationDTOs(mailer)).thenReturn(List.of(
                componentConfiguration(ComponentConfigurationDTO.FAILED_ACTIVATION, PID + "~imap"),
                componentConfiguration(ComponentConfigurationDTO.ACTIVE, PID + "~smtp")));

        List<Map<String, Object>> result = find(instanceFile, PID + "~smtp");

        assertEquals(List.of("ACTIVE"), usages(result.get(0)).get(0).get("states"),
                "the other instance's failure is not this file's");
    }

    @Test
    @DisplayName("DS factory: an unloaded instance reports no state, not the other instances' states")
    void unloadedFactoryInstanceReportsNoForeignState() {
        ComponentDescriptionDTO mailer = component("org.example.mail.Mailer", mailBundle, PID);
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of(mailer));
        when(runtime.isComponentEnabled(mailer)).thenReturn(true);
        when(runtime.getComponentConfigurationDTOs(mailer)).thenReturn(List.of(
                componentConfiguration(ComponentConfigurationDTO.FAILED_ACTIVATION, PID + "~hidden")));

        List<Map<String, Object>> result = find(PID + "~smtp.cfg.disabled", PID + "~smtp");

        assertEquals(List.of(), usages(result.get(0)).get(0).get("states"),
                "another instance's state belongs to another file, which may be hidden");
    }

    @Test
    @DisplayName("a configuration deleted during the lookup is skipped, not an internal error")
    void skipsConfigurationDeletedDuringLookup() throws Exception {
        Configuration deleted = mock(Configuration.class);
        when(deleted.getPid()).thenThrow(new IllegalStateException("Configuration deleted"));
        when(deleted.getFactoryPid()).thenThrow(new IllegalStateException("Configuration deleted"));
        when(deleted.getBundleLocation()).thenThrow(new IllegalStateException("Configuration deleted"));
        Configuration alive = configuration(PID, null, "mvn:org.example/mail/2.4.1");
        when(configurationAdmin.listConfigurations(LOADED_FILTER)).thenReturn(new Configuration[] {deleted, alive});

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(1, result.size());
        assertEquals(List.of(Map.of("kind", "BOUND", "detail", PID, "states", List.of())), usages(result.get(0)));
    }

    @Test
    @DisplayName("a file whose only configuration was deleted meanwhile falls back to its name")
    void fallsBackToNameWhenTheOnlyConfigurationIsGone() throws Exception {
        Configuration deleted = mock(Configuration.class);
        when(deleted.getPid()).thenThrow(new IllegalStateException("Configuration deleted"));
        when(configurationAdmin.listConfigurations(LOADED_FILTER)).thenReturn(new Configuration[] {deleted});

        ConfigurationUsageLookup.Target target =
                new ConfigurationUsageLookup(context, configurationAdmin, runtime, metaTypeService).resolveTarget(FILE, PID);

        assertEquals(PID, target.pid);
        assertTrue(target.configurations.isEmpty());
    }

    @Test
    @DisplayName("managed service: a ManagedService registered with the PID names its bundle")
    void reportsManagedService() throws Exception {
        ServiceReference<?> reference = mock(ServiceReference.class);
        when(reference.getBundle()).thenReturn(otherBundle);
        when(context.getAllServiceReferences(ManagedService.class.getName(), "(service.pid=" + PID + ")"))
                .thenReturn(new ServiceReference<?>[] {reference});

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(1, result.size());
        assertEquals("org.example.other", result.get(0).get("symbolicName"));
        assertEquals("1.0.0", result.get(0).get("version"));
        assertEquals("MANAGED_SERVICE", usages(result.get(0)).get(0).get("kind"));
    }

    @Test
    @DisplayName("managed service factory: an unloaded <pid>-<name> file is read as a factory instance")
    void reportsManagedServiceFactoryForDashInstance() throws Exception {
        ServiceReference<?> reference = mock(ServiceReference.class);
        when(reference.getBundle()).thenReturn(otherBundle);
        when(context.getAllServiceReferences(ManagedServiceFactory.class.getName(), "(service.pid=" + PID + ")"))
                .thenReturn(new ServiceReference<?>[] {reference});

        List<Map<String, Object>> result = find(PID + "-smtp.cfg.disabled", PID + "-smtp");

        assertEquals(1, result.size());
        assertEquals(Map.of("kind", "MANAGED_SERVICE_FACTORY", "detail", PID, "states", List.of()),
                usages(result.get(0)).get(0));
    }

    @Test
    @DisplayName("metatype: the bundle declaring the PID's Metatype")
    void reportsMetatypeProvider() {
        MetaTypeInformation information = mock(MetaTypeInformation.class);
        when(information.getPids()).thenReturn(new String[] {PID});
        when(metaTypeService.getMetaTypeInformation(mailBundle)).thenReturn(information);

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(1, result.size());
        assertEquals("METATYPE", usages(result.get(0)).get(0).get("kind"));
    }

    @Test
    @DisplayName("one entry per bundle, its usages in a fixed order, bundles sorted by symbolic name")
    void groupsUsagesPerBundle() throws Exception {
        givenLoaded(LOADED_FILTER, PID, null, "mvn:org.example/mail/2.4.1");
        MetaTypeInformation information = mock(MetaTypeInformation.class);
        when(information.getPids()).thenReturn(new String[] {PID});
        when(metaTypeService.getMetaTypeInformation(mailBundle)).thenReturn(information);
        ComponentDescriptionDTO mailer = component("org.example.mail.Mailer", mailBundle, PID);
        when(runtime.getComponentDescriptionDTOs()).thenReturn(List.of(mailer));
        when(runtime.isComponentEnabled(mailer)).thenReturn(true);
        when(runtime.getComponentConfigurationDTOs(mailer)).thenReturn(List.of());
        ServiceReference<?> reference = mock(ServiceReference.class);
        when(reference.getBundle()).thenReturn(otherBundle);
        when(context.getAllServiceReferences(ManagedService.class.getName(), "(service.pid=" + PID + ")"))
                .thenReturn(new ServiceReference<?>[] {reference});

        List<Map<String, Object>> result = find(FILE, PID);

        assertEquals(List.of("org.example.mail.impl", "org.example.other"),
                List.of(result.get(0).get("symbolicName"), result.get(1).get("symbolicName")));
        assertEquals(List.of("BOUND", "COMPONENT", "METATYPE"),
                usages(result.get(0)).stream().map(usage -> usage.get("kind")).collect(java.util.stream.Collectors.toList()));
    }

    @Test
    @DisplayName("none: no binding, component, service or Metatype gives an empty list")
    void reportsNothingWhenNoBundleUsesIt() {
        assertTrue(find(FILE, PID).isEmpty());
    }

    @Test
    @DisplayName("none: with no OSGi service available at all, nothing is reported and nothing fails")
    void degradesWithoutServices() throws Exception {
        when(context.getAllServiceReferences(anyString(), anyString())).thenThrow(new IllegalStateException("stopping"));

        assertTrue(new ConfigurationUsageLookup(context, null, null, null).find(FILE, PID).isEmpty());
    }

    @Test
    @DisplayName("the file name is escaped in the filter: it is the caller's input")
    void escapesFilterValues() {
        assertEquals("a\\(b\\)\\*c\\\\d.cfg", ConfigurationUsageLookup.escapeFilterValue("a(b)*c\\d.cfg"));
    }

    @Test
    @DisplayName("a Bundle-Name header is used as the display name")
    void usesBundleNameHeader() throws Exception {
        Hashtable<String, String> headers = new Hashtable<>();
        headers.put("Bundle-Name", "Example Mail");
        when(mailBundle.getHeaders()).thenReturn(headers);
        givenLoaded(LOADED_FILTER, PID, null, "mvn:org.example/mail/2.4.1");

        assertEquals("Example Mail", find(FILE, PID).get(0).get("name"));
    }
}
