/**
 * Guards the Babel setup against the trap that cost half a day.
 *
 * Babel 8 changed @babel/preset-react's default runtime from "classic" to "automatic", compiling
 * JSX into imports of react/jsx-runtime and react/jsx-dev-runtime. Jahia's app-shell shares React
 * as a module-federation singleton and does not share those subpaths, so a bundle built that way
 * dies in the browser on first render — "TypeError: (0 , I.jsxDEV) is not a function" — taking the
 * whole admin app down.
 *
 * Nothing local caught it. The webpack build succeeded, tsc was clean and all 120 Jest tests
 * passed, because Jest compiled through babel.config.js while the bundle compiled through inline
 * babel-loader options that shadowed it. Only the e2e workflow showed the failure, and the first
 * fix went into the wrong file for the same reason.
 *
 * These tests close that gap without needing a build. The first two assert the shared config pins
 * the classic runtime in both environments; the third asserts webpack still defers to that config
 * instead of declaring presets of its own. Together they say what the bundle will do.
 *
 * They deliberately do not run Babel: @babel/core 8 is ESM-only and cannot be required from
 * Jest's CommonJS runtime. Asserting the configuration is enough, since the configuration is
 * exactly what drifted.
 */

const babelConfig = require('./babel.config');

/** Calls the config factory the way Babel would, for a given environment. */
const configFor = envName => babelConfig({ env: name => name === envName });

const presetOptions = (config, presetName) => {
    const entry = config.presets.find(p => Array.isArray(p) && p[0] === presetName);
    return entry ? entry[1] : undefined;
};

describe('Babel configuration', () => {
    test('pins the classic JSX runtime for the bundle', () => {
        expect(presetOptions(configFor('production'), '@babel/preset-react'))
            .toMatchObject({ runtime: 'classic' });
    });

    test('pins the classic JSX runtime for Jest too, so both compile JSX alike', () => {
        expect(presetOptions(configFor('test'), '@babel/preset-react'))
            .toMatchObject({ runtime: 'classic' });
    });

    test('targets browsers for the bundle and the running Node under Jest', () => {
        // The two environments legitimately differ here — which is why one shared config with an
        // env branch is the right shape, rather than two configs that can drift.
        expect(presetOptions(configFor('production'), '@babel/preset-env'))
            .toMatchObject({ modules: false, targets: { chrome: expect.any(String) } });

        expect(presetOptions(configFor('test'), '@babel/preset-env'))
            .toMatchObject({ targets: { node: 'current' } });
    });

    test('the webpack rule declares no Babel options, so it cannot shadow babel.config.js', () => {
        const config = require('./webpack.config')({}, { mode: 'production' });

        const babelRules = config.module.rules
            .filter(rule => JSON.stringify(rule.use || '').includes('babel-loader'));

        // One rule handles .jsx today; if that changes, revisit this deliberately.
        expect(babelRules).toHaveLength(1);

        const { use } = babelRules[0];
        const options = typeof use === 'object' ? use.options : undefined;

        // Presets declared here would silently win over babel.config.js — exactly how the bundle
        // and Jest came to disagree.
        expect(options?.presets).toBeUndefined();
    });
});
