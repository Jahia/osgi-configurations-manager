module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.jsx?$': 'babel-jest',
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.jest.json'
        }],
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/target/'],
    modulePathIgnorePatterns: ['<rootDir>/target/', '<rootDir>/src/main/resources/javascript/apps/'],
    // Coverage is collected from the application sources only (see `yarn test:coverage`).
    collectCoverageFrom: [
        'src/javascript/**/*.{ts,tsx,js,jsx}',
        '!src/javascript/**/*.test.{ts,tsx,js,jsx}',
        '!src/javascript/**/*.d.ts',
    ],
    coveragePathIgnorePatterns: ['/node_modules/', '/target/'],
    // Ratchet floor: enforced by `yarn test:coverage`. Raise toward 80% as the heavy view
    // components (Editor/CfgEditor/Monaco) gain tests; logic modules already sit well above this.
    coverageThreshold: {
        global: {
            statements: 33,
            branches: 20,
            functions: 27,
            lines: 31,
        },
    },
};
