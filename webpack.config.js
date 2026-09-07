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
                    // No options here on purpose: inline babel-loader options shadow
                    // babel.config.js entirely, and while they did, the bundle and Jest compiled
                    // JSX differently without anything failing. babel.config.js is the single
                    // source of truth, and babel-config.test.js asserts this rule stays bare.
                    use: 'babel-loader'
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
