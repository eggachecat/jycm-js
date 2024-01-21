const path = require('path');

module.exports = [
    {
        mode: 'production',
        entry: './src/index.ts',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                },
                {
                    test: /\.js$/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js']
        },
        output: {
            filename: 'index.js',
            path: path.resolve(__dirname, 'dist'),
            library: {
                name: 'jycm',
                type: 'umd'
            },
            globalObject: 'this'
        }
    }
];
