module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.jsx?$': 'babel-jest',
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.jest.json'
        }],
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': '<rootDir>/jest-mocks/styleMock.js',
        // SUPPORT-646: jsdom-safe stubs for the Monaco editor (S42/G25). The real editor
        // cannot run in jsdom; deep editor behaviour is covered by Cypress (S50).
        '^monaco-editor$': '<rootDir>/jest-mocks/monaco-editor.js',
        '^monaco-yaml$': '<rootDir>/jest-mocks/monaco-yaml.js',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/target/'],
    modulePathIgnorePatterns: ['<rootDir>/target/', '<rootDir>/src/main/resources/javascript/apps/'],
};
