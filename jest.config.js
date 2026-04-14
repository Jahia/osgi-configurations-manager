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
};
