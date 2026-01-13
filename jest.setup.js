// Used for __tests__/testing-library.js
// learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

// Mock contextJsParameters which is used in osgiService
global.contextJsParameters = {
    contextPath: ''
};
