// Used for __tests__/testing-library.js
// learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

// Mock contextJsParameters which is used in osgiService
global.contextJsParameters = {
    contextPath: ''
};

// SUPPORT-646: jsdom lacks ResizeObserver, which MonacoEditor.jsx instantiates on mount.
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
