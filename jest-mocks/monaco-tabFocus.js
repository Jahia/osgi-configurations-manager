// jsdom-safe stand-in for Monaco's page-wide Tab focus state (vs/editor/browser/config/tabFocus),
// with the same API: the toolbar toggle and Monaco's Ctrl+M command both go through it.

const listeners = [];
let tabFocus = false;

const TabFocus = {
    getTabFocusMode: () => tabFocus,
    setTabFocusMode: (value) => {
        tabFocus = value;
        listeners.slice().forEach(cb => cb(tabFocus));
    },
    onDidChangeTabFocus: (cb) => {
        listeners.push(cb);
        return { dispose: () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
        } };
    }
};

module.exports = { TabFocus };
