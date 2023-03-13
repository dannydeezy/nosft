import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { TESTNET, ASSUMED_TX_BYTES } from "@lib/constants";
import LocalStorage, { LocalStorageKeys } from "@services/local-storage";

bitcoin.initEccLib(ecc);

export const outputValue = (currentUtxo, sendFeeRate) => currentUtxo.value - sendFeeRate * ASSUMED_TX_BYTES;

export const ordinalsUrl = (utxo) => `https://ordinals.com/output/${utxo.txid}:${utxo.vout}`;

export const ordinalsImageUrl = (utxo) => `https://ordinals.com/content/${utxo.txid}i${utxo.vout}`;

export const cloudfrontUrl = (utxo) => `https://d2v3k2do8kym1f.cloudfront.net/minted-items/${utxo.txid}:${utxo.vout}`;

export const shortenStr = (str) => {
    if (!str) return "";
    return `${str.substring(0, 8)}...${str.substring(str.length - 8, str.length)}`;
};

export const getAddressInfo = (nostrPublicKey) => {
    console.log(`Nostr pub: ${nostrPublicKey}`);
    const pubkeyBuffer = Buffer.from(nostrPublicKey, "hex");
    const addrInfo = bitcoin.payments.p2tr({
        pubkey: pubkeyBuffer,
        network: TESTNET ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
    });
    return addrInfo;
};

export const connectWallet = async () => {
    if (window.nostr && window.nostr.enable) {
        await window.nostr.enable();
    } else {
        alert(
            "Oops, it looks like you haven't set up your Nostr key yet. Go to your Alby Account Settings and create or import a Nostr key."
        );
        return undefined;
    }
    return window.nostr.getPublicKey();
};

export const clearStorageCache = () => {
    const inscriptions = LocalStorage.get(LocalStorageKeys.INSCRIPTIONS_OWNED);
    if (!inscriptions) return;
    LocalStorage.remove(LocalStorageKeys.INSCRIPTIONS_OWNED);
    inscriptions.forEach(({ key }) => LocalStorage.remove(`${LocalStorageKeys.INSCRIPTIONS_OWNED}:utxo:${key}`));
};
