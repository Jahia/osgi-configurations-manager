module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        // Babel 8 changed preset-react's default runtime from "classic" to "automatic", which
        // compiles JSX into imports of react/jsx-runtime and react/jsx-dev-runtime. Jahia's
        // app-shell provides React as a module-federation singleton, and those subpath imports do
        // not resolve against it — the bundle dies in the browser on first render with
        // "TypeError: (0 , I.jsxDEV) is not a function", taking the whole admin app down.
        //
        // React 18 does ship both entry points, so their absence was not the whole story; the
        // subpath simply is not shared. Pinning the classic runtime removes the question: JSX
        // compiles to React.createElement, which resolves against the shared React like any other
        // React API. Revisit if Jahia starts sharing the jsx-runtime subpaths.
        ['@babel/preset-react', { runtime: 'classic' }],
    ],
};
