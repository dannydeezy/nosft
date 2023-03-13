const LocalStorageKeys = {
    NOSTR_PUBLIC_KEY: "NOSTR_PUBLIC_KEY",
    INSCRIPTIONS_ON_SALE: "INSCRIPTIONS_ON_SALE",
    INSCRIPTIONS_OWNED: "INSCRIPTIONS_OWNED",
    INSCRIPTION_NUMBER: "INSCRIPTION_NUMBER",
};

const LocalStorage = {
    set: (id, data) => {
        if (typeof window === "undefined") {
            return undefined;
        }

        window.localStorage.setItem(id, JSON.stringify(data));
        return undefined;
    },
    get: (id) => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const value = window.localStorage.getItem(id);

        if (!value || value === "undefined") {
            return undefined;
        }

        return JSON.parse(value);
    },
    remove: (id) => {
        if (typeof window === "undefined") {
            return undefined;
        }

        return window.localStorage.removeItem(id);
    },
};

export default LocalStorage;
export { LocalStorageKeys };
