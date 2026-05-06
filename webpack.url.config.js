const path = require('path');
const WebpackNotifierPlugin = require('webpack-notifier');

module.exports = {
    mode: 'production',
    devtool: 'source-map',
    entry: {
        'index77': './src/entry/index-url.js'
    },
    output: {
        path: path.resolve(__dirname, 'web-client/js'),
        filename: '[name].js',
        library: 'ScratchJr',
        libraryTarget: 'window'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: /node_modules/,
                use: ['strip-sourcemap-loader']
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['es2015', 'stage-3']
                    }
                }
            }
        ]
    },
    plugins: [
        new WebpackNotifierPlugin({
            title: "ScratchJr URL Build",
            alwaysNotify: true
        })
    ],
    resolve: {
        extensions: ['.js', '.jsx']
    }
};