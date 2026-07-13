// Committed stand-in for style imports (css/less/scss/sass) in Jest.
// Replaces the previous __mocks__/styleMock.js, which lived under a git-ignored directory
// and was therefore missing on a clean checkout (would break every Jest run in CI).
module.exports = {};
