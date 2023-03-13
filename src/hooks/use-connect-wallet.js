import { useState, useEffect } from "react";
import { connectWallet } from "@utils/crypto";
import LocalStorage, { LocalStorageKeys } from "@services/local-storage";
import { clearStorageCache } from "src/utils";

function useConnectWallet() {
    const [nostrPublicKey, setNostrPublicKey] = useState();

    const onConnectHandler = async () => {
        const pubKey = await connectWallet();
        setNostrPublicKey(pubKey);
    };

    const onDisconnectHandler = async () => {
        setNostrPublicKey(undefined);
        LocalStorage.remove(LocalStorageKeys.NOSTR_PUBLIC_KEY);
        clearStorageCache();
    };

    useEffect(() => {
        async function getAddrInfo() {
            if (nostrPublicKey) {
                LocalStorage.set(LocalStorageKeys.NOSTR_PUBLIC_KEY, nostrPublicKey);
            }
        }

        getAddrInfo();
    }, [nostrPublicKey]);

    useEffect(() => {
        // TODO: We should ask the browser if we are connected to the wallet
        const pubKey = LocalStorage.get(LocalStorageKeys.NOSTR_PUBLIC_KEY);

        if (pubKey) {
            setNostrPublicKey(pubKey);
        }
    }, []);

    return { nostrPublicKey, onConnectHandler, onDisconnectHandler };
}

export default useConnectWallet;
