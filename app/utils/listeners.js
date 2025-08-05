const listeners = [];

export const pushListeners = (listener) => listeners.push(listener);
export const unsubListeners = () => listeners.map(obj => obj());