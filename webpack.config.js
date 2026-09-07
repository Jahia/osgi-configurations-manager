const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const getModuleFederationConfig = require('@jahia/webpack-config/getModuleFederationConfig');
const packageJson = require('./package.json');

module.exports = (env, argv) => {
    let config = {
        entry: {
            'osgiConfigManager.bundle': [path.resolve(__dirname, 'src/javascript/index.js')],
            'yaml.worker': path.resolve(__dirname, 'node_modules/monaco-yaml/yaml.worker.js'),
            'editor.worker': path.resolve(__dirname, 'node_modules/monaco-editor/esm/vs/editor/editor.worker.js')
        },
        output: {
            path: path.resolve(__dirname, 'src/main/resources/javascript/apps/'),
            filename: '[name].js',
            chunkFilename: '[name].osgiConfigManager.[chunkhash:6].js', // chunkhash is important for cache busting and correct worker loading? No, simple [name] might be better for workers if we hardcode paths.
            // Actually, MonacoWebpackPlugin usually handles worker paths.
            // Let's keep chunkhash but maybe we need publicPath?
            // Jahia modules usually need proper publicPath or Monaco will try to load from root.
            publicPath: (argv.mode === 'production' ? '/modules/osgi-configurations-manager/javascript/apps/' : 'http://localhost:8080/modules/osgi-configurations-manager/javascript/apps/')
        },
        resolve: {
            mainFields: ['module', 'main'],
            extensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
        },
        module: {
            rules: [
                {
                    test: /\.m?js$/,
                    type: 'javascript/auto'
                },
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.jsx?$/,
                    include: [path.join(__dirname, 'src')],
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    modules: false,
                                    targets: { chrome: '60', edge: '44', firefox: '54', safari: '12' }
                                }],
                                // Babel 8 changed preset-react's default runtime from "classic" to
                                // "automatic", which compiles JSX into imports of
                                // react/jsx-runtime and react/jsx-dev-runtime. Jahia's app-shell
                                // shares React as a module-federation singleton and does not share
                                // those subpaths, so the bundle dies in the browser on first render
                                // with "TypeError: (0 , I.jsxDEV) is not a function" — the whole
                                // admin app goes down. Pin the classic runtime: JSX becomes
                                // React.createElement, which resolves against the shared React like
                                // any other React API. This matches tsconfig's "jsx": "react", so
                                // .tsx (ts-loader) and .jsx (here) now agree.
                                //
                                // These inline options SHADOW babel.config.js entirely, so setting
                                // the runtime there has no effect on the bundle.
                                ['@babel/preset-react', { runtime: 'classic' }]
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    include: /node_modules\/monaco-editor/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.css$/,
                    exclude: /node_modules\/monaco-editor/,
                    use: [
                        'style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                modules: {
                                    auto: true,
                                    namedExport: false,
                                },
                            },
                        },
                    ],
                },
            ]
        },
        plugins: [
            new ModuleFederationPlugin(getModuleFederationConfig(packageJson)),
            new CleanWebpackPlugin({ verbose: false }),
            new CopyWebpackPlugin({ patterns: [{ from: './package.json', to: '' }] })
        ],
        performance: argv.mode === 'production' ? {
            hints: false
        } : undefined,
        mode: 'development'
    };

    config.devtool = (argv.mode === 'production') ? 'source-map' : 'eval-source-map';

    return config;
};
