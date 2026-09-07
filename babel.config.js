// The single source of truth for Babel, used by both webpack and Jest.
//
// The webpack rule deliberately declares no presets of its own. Inline babel-loader options
// shadow this file completely, and while they did, the two halves of the build drifted apart
// without anything failing: Jest compiled one way, the bundle another. babel-config.test.js
// guards against that returning.

// Browsers the module supports. Under Jest the target is instead the Node running the tests.
const browserTargets = { chrome: '60', edge: '44', firefox: '54', safari: '12' };

module.exports = api => {
    // babel-jest sets BABEL_ENV / NODE_ENV to "test".
    const forJest = api.env('test');

    return {
        presets: [
            ['@babel/preset-env', forJest
                ? { targets: { node: 'current' } }
                // modules: false leaves ES modules intact so webpack can tree-shake.
                : { modules: false, targets: browserTargets }],

            // Babel 8 changed preset-react's default runtime from "classic" to "automatic", which
            // compiles JSX into imports of react/jsx-runtime and react/jsx-dev-runtime. Jahia's
            // app-shell shares React as a module-federation singleton and does NOT share those
            // subpaths, so the bundle dies in the browser on first render with
            // "TypeError: (0 , I.jsxDEV) is not a function", taking the whole admin app down.
            //
            // React 18 ships both entry points, so their absence was never the real cause — the
            // subpath simply is not shared, whatever React provides. The classic runtime compiles
            // JSX to React.createElement, which resolves against the shared React like any other
            // React API, and matches tsconfig's "jsx": "react" so .tsx and .jsx agree.
            //
            // Revisit only if Jahia starts sharing the jsx-runtime subpaths.
            ['@babel/preset-react', { runtime: 'classic' }]
        ]
    };
};
