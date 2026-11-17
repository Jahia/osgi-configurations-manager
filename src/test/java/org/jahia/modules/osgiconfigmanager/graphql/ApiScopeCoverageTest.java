package org.jahia.modules.osgiconfigmanager.graphql;

import graphql.annotations.annotationTypes.GraphQLName;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Jahia's security filter refuses a GraphQL type that no API scope grants, and the module's scope
 * file is a default configuration: an upgrade does not rewrite it on an instance that has it. A new
 * output type would therefore answer "Permission denied" on every existing instance, root included,
 * while working on a fresh one. Complex results are returned as JSON strings instead (see
 * {@code availableMetatypes}, {@code bundleUsage}); this keeps the set of types the one the scope names.
 */
class ApiScopeCoverageTest {

    private static final String SCOPE_FILE =
            "META-INF/configurations/org.jahia.bundles.api.authorization-osgi-configurations-manager.yml";

    @Test
    @DisplayName("every GraphQL type of the module is granted by the scope that existing instances already have")
    void everyTypeIsInTheScope() throws IOException, URISyntaxException {
        String scope = new String(getClass().getClassLoader().getResourceAsStream(SCOPE_FILE).readAllBytes(),
                StandardCharsets.UTF_8);
        Path packageDir = Paths.get(GqlConfigFile.class.getResource(GqlConfigFile.class.getSimpleName() + ".class").toURI())
                .getParent();

        List<String> ungranted;
        try (Stream<Path> classes = Files.list(packageDir)) {
            ungranted = classes
                    .map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(".class") && !name.contains("$"))
                    .map(name -> load(name.substring(0, name.length() - ".class".length())))
                    .filter(type -> type.isAnnotationPresent(GraphQLName.class))
                    .map(type -> type.getAnnotation(GraphQLName.class).value())
                    .filter(name -> !scope.contains("graphql." + name))
                    .sorted()
                    .collect(Collectors.toList());
        }

        assertEquals(List.of(), ungranted);
    }

    private static Class<?> load(String simpleName) {
        try {
            return Class.forName(GqlConfigFile.class.getPackageName() + "." + simpleName);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }
}
