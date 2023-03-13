// This file is an adaption of the original https://github.com/orenyomtov/openordex
// we should try to keep it as close to the original as possible, even though, ideally,
// we would use the original package if we can make it a library.
/* eslint-disable */
import { IS_PRODUCTION, NOSTR_RELAY_URL, NOSTR_KIND_INSCRIPTION, MEMPOOL_BASE_URL } from "@lib/constants.config";
import { getAddressInfo, toXOnly } from "@utils/crypto";
import { getAddressUtxos } from "@utils/utxos";
import { relayInit, getEventHash } from "nostr-tools";
import { serializeTaprootSignature } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { Observable } from "rxjs";

bitcoin.initEccLib(ecc);

const baseMempoolApiUrl = `${MEMPOOL_BASE_URL}/api`;
const bitcoinPriceApiUrl = "https://blockchain.info/ticker?cors=true";
const feeLevel = "hourFee"; // "fastestFee" || "halfHourFee" || "hourFee" || "economyFee" || "minimumFee"
const ordinalsExplorerUrl = IS_PRODUCTION ? "https://ordinals.com" : "https://explorer-signet.openordex.org";

const network = IS_PRODUCTION ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const networkName = IS_PRODUCTION ? "mainnet" : "signet";
const exchangeName = "nosft";
const dummyUtxoValue = 1_000;
const numberOfDummyUtxosToCreate = 1;
const isBrowser = typeof window !== "undefined";

const recommendedFeeRate = fetch(`${baseMempoolApiUrl}/v1/fees/recommended`)
    .then((response) => response.json())
    .then((data) => data[feeLevel]);

async function doesUtxoContainInscription(utxo) {
    const html = await fetch(`${ordinalsExplorerUrl}/output/${utxo.txid}:${utxo.vout}`).then((response) =>
        response.text()
    );

    return html.match(/class=thumbnails/) !== null;
}

function satsToFormattedDollarString(sats, _bitcoinPrice) {
    return (satToBtc(sats) * _bitcoinPrice).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function btcToSat(btc) {
    return Math.floor(Number(btc) * 10 ** 8);
}

function satToBtc(sat) {
    return Number(sat) / 10 ** 8;
}

async function selectUtxos(utxos, amount, vins, vouts, recommendedFeeRate) {
    const selectedUtxos = [];
    let selectedAmount = 0;

    // Sort descending by value, and filter out dummy utxos
    utxos = utxos.filter((x) => x.value > dummyUtxoValue).sort((a, b) => b.value - a.value);

    for (const utxo of utxos) {
        // Never spend a utxo that contains an inscription for cardinal purposes
        if (await doesUtxoContainInscription(utxo)) {
            continue;
        }
        selectedUtxos.push(utxo);
        selectedAmount += utxo.value;

        if (
            selectedAmount >=
            amount + dummyUtxoValue + calculateFee(vins + selectedUtxos.length, vouts, recommendedFeeRate)
        ) {
            break;
        }
    }

    if (selectedAmount < amount) {
        throw new Error(`Not enough cardinal spendable funds.
Address has:  ${satToBtc(selectedAmount)} BTC
Needed:          ${satToBtc(amount)} BTC`);
    }

    return selectedUtxos;
}

function calculateFee(vins, vouts, recommendedFeeRate, includeChangeOutput = true) {
    const baseTxSize = 10;
    const inSize = 180;
    const outSize = 34;

    const txSize = baseTxSize + vins * inSize + vouts * outSize + includeChangeOutput * outSize;
    const fee = txSize * recommendedFeeRate;

    return fee;
}

class OpenOrdexFactory {
    constructor() {
        this.connected = false;
        this.bitcoinPrice = undefined;
        this.recommendedFeeRate = undefined;
        this.nostrRelay = relayInit(NOSTR_RELAY_URL);
        this.connect();
        this.orders = {};
        this.txHexByIdCache = {};

        // TODO: This shouldnt be happening...
        this.sellerSignedPsbt = undefined;
        this.price = undefined;

        this.paymentUtxos = undefined;
        this.dummyUtxo = undefined;
    }

    async connect() {
        if (this.connected || !isBrowser) return;
        this.nostrRelay
            .connect()
            .then(() => {
                this.connected = true;
            })
            .catch((error) => {
                this.connected = false;
                console.error("error to nostr relay", error);
            });
    }

    async init() {
        await this.connect();
        this.bitcoinPrice = fetch(bitcoinPriceApiUrl)
            .then((response) => response.json())
            .then((data) => data.USD.last);
        this.recommendedFeeRate = fetch(`${baseMempoolApiUrl}/v1/fees/recommended`)
            .then((response) => response.json())
            .then((data) => data[feeLevel]);
        return this;
    }

    validateSellerPSBTAndExtractPrice(sellerSignedPsbtBase64, utxo) {
        try {
            this.sellerSignedPsbt = bitcoin.Psbt.fromBase64(sellerSignedPsbtBase64, {
                network,
            });
            const sellerInput = this.sellerSignedPsbt.txInputs[0];
            const sellerSignedPsbtInput = `${sellerInput.hash.reverse().toString("hex")}:${sellerInput.index}`;

            if (sellerSignedPsbtInput != utxo) {
                throw `Seller signed PSBT does not match this inscription\n\n${sellerSignedPsbtInput}\n!=\n${utxo}`;
            }

            if (this.sellerSignedPsbt.txInputs.length != 1 || this.sellerSignedPsbt.txInputs.length != 1) {
                throw `Invalid seller signed PSBT`;
            }

            try {
                this.sellerSignedPsbt.extractTransaction(true);
            } catch (e) {
                if (e.message == "Not finalized") {
                    throw "PSBT not signed";
                } else if (e.message != "Outputs are spending more than Inputs") {
                    throw `Invalid PSBT ${e.message}` || e;
                }
            }

            const sellerOutput = this.sellerSignedPsbt.txOutputs[0];
            this.price = sellerOutput.value;

            return Number(this.price);
        } catch (e) {
            console.error(e);
        }
    }

    isSaleOrder(order) {
        return order.tags.find((x) => x?.[0] == "s")?.[1];
    }

    getInscriptionId(order) {
        return order.tags.find((x) => x?.[0] == "i")[1];
    }

    isProcessed(orders, inscriptionId) {
        return orders.find((x) => x.inscriptionId == inscriptionId);
    }

    async getProcessedOrder(order, orders = []) {
        if (!this.isSaleOrder(order)) return;
        const inscriptionId = this.getInscriptionId(order);
        if (this.isProcessed(orders, inscriptionId)) return;

        const inscriptionData = await this.getInscriptionDataById(inscriptionId);
        const validatedPrice = this.validateSellerPSBTAndExtractPrice(order.content, inscriptionData.output);
        if (!validatedPrice) return;

        const newOrder = {
            title: `$${satsToFormattedDollarString(validatedPrice, await this.bitcoinPrice)}`,
            txid: order.id,
            inscriptionId,
            value: validatedPrice,
            usdPrice: `$${satsToFormattedDollarString(validatedPrice, await this.bitcoinPrice)}`,
            ...order,
        };

        return newOrder;
    }

    latestOrders({ limit }) {
        return new Observable(async (observer) => {
            try {
                const latestOrders = [];
                const orders = await this.nostrRelay.list([
                    {
                        kinds: [NOSTR_KIND_INSCRIPTION],
                        limit: limit,
                    },
                ]);

                for (const order of orders) {
                    try {
                        const newOrder = await this.getProcessedOrder(order, latestOrders);
                        if (!newOrder) continue;
                        observer.next(newOrder);
                        latestOrders.push(newOrder);
                        if (latestOrders.length >= limit) {
                            break;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            } catch (error) {
                observer.error(error);
            }
        });
    }

    async getTxHexById(txId) {
        if (!this.txHexByIdCache[txId]) {
            this.txHexByIdCache[txId] = await fetch(`${baseMempoolApiUrl}/tx/${txId}/hex`).then((response) =>
                response.text()
            );
        }

        return this.txHexByIdCache[txId];
    }

    async getInscriptionDataById(inscriptionId, verifyIsInscriptionNumber) {
        const html = await fetch(`${ordinalsExplorerUrl}/inscription/${inscriptionId}`).then((response) =>
            response.text()
        );

        const data = [...html.matchAll(/<dt>(.*?)<\/dt>\s*<dd.*?>(.*?)<\/dd>/gm)]
            .map((x) => {
                x[2] = x[2].replace(/<.*?>/gm, "");
                return x;
            })
            .reduce((a, b) => ({ ...a, [b[1]]: b[2] }), {});

        const error = `Inscription ${
            verifyIsInscriptionNumber || inscriptionId
        } not found (maybe you're on signet and looking for a mainnet inscription or vice versa)`;
        try {
            data.number = html.match(/<h1>Inscription (\d*)<\/h1>/)[1];
        } catch {
            throw new Error(error);
        }
        if (verifyIsInscriptionNumber && String(data.number) != String(verifyIsInscriptionNumber)) {
            throw new Error(error);
        }

        return data;
    }

    // Sell
    async generatePSBTListingInscriptionForSale(ordinalOutput, price, paymentAddress) {
        const psbt = new bitcoin.Psbt({ network });

        const pk = await window.nostr.getPublicKey();
        const publicKey = Buffer.from(pk, "hex");
        const inputAddressInfo = getAddressInfo(pk);

        const [ordinalUtxoTxId, ordinalUtxoVout] = ordinalOutput.split(":");
        const tx = bitcoin.Transaction.fromHex(await this.getTxHexById(ordinalUtxoTxId));
        for (const output in tx.outs) {
            try {
                tx.setWitness(parseInt(output), []);
            } catch {}
        }

        debugger;
        psbt.addInput({
            hash: ordinalUtxoTxId,
            index: parseInt(ordinalUtxoVout),
            // nonWitnessUtxo: tx.toBuffer(),
            // witnessUtxo: tx.outs[ordinalUtxoVout],
            witnessUtxo: {
                value: price,
                script: inputAddressInfo.output,
            },
            tapInternalKey: toXOnly(publicKey),
            // sighashType:
            //     bitcoin.Transaction.SIGHASH_SINGLE |
            //     bitcoin.Transaction.SIGHASH_ANYONECANPAY,
        });

        psbt.addOutput({
            address: paymentAddress,
            value: price, // @danny does this needs outputValue(price, feeRate)
        });

        const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
            0,
            [inputAddressInfo.output],
            [price],
            bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY
        );

        const sig = await window.nostr.signSchnorr(sigHash.toString("hex"));
        psbt.updateInput(0, {
            tapKeySig: serializeTaprootSignature(Buffer.from(sig, "hex")),
        });

        psbt.finalizeAllInputs();
        return psbt.toBase64();
    }

    async publishSellerPsbt(signedSalePsbt, inscriptionId, inscriptionUtxo, priceInSats) {
        const pk = await window.nostr.getPublicKey();

        const event = {
            kind: NOSTR_KIND_INSCRIPTION,
            pubkey: pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["n", networkName], // Network name (e.g. "mainnet", "signet")
                ["t", "sell"], // Type of order (e.g. "sell", "buy")
                ["i", inscriptionId], // Inscription ID
                ["u", inscriptionUtxo], // Inscription UTXO
                ["s", priceInSats.toString()], // Price in sats
                ["x", exchangeName], // Exchange name (e.g. "openordex")
            ],
            content: signedSalePsbt,
        };
        event.id = getEventHash(event);
        const signedEvent = await window.nostr.signEvent(event);

        await this.nostrRelay.publish(signedEvent);
    }

    async submitSignedSalePsbt(inscription, price, signedSalePsbt) {
        try {
            bitcoin.Psbt.fromBase64(signedSalePsbt, {
                network,
            }).extractTransaction(true);
        } catch (e) {
            if (e.message == "Not finalized") {
                return alert("Please sign and finalize the PSBT before submitting it");
            }
            if (e.message != "Outputs are spending more than Inputs") {
                console.error(e);
                return alert("Invalid PSBT", e.message || e);
            }
        }

        try {
            await this.publishSellerPsbt(
                signedSalePsbt,
                inscription.inscriptionId,
                inscription.txid, // TODO: Make sure this is the correct UTXO
                btcToSat(price)
            );
        } catch (e) {
            console.error(e);
            alert("Error publishing seller PSBT", e.message || e);
        }
    }

    // Buy
    async createDummuyUtxo(payerAddress) {
        return this.generatePSBTGeneratingDummyUtxos(payerAddress, 1, this.paymentUtxos);
    }

    async generatePSBTGeneratingDummyUtxos(payerAddress) {
        const psbt = new bitcoin.Psbt({ network });

        const publicKey = Buffer.from(await window.nostr.getPublicKey(), "hex");
        const inputAddressInfo = getAddressInfo(publicKey);

        debugger;
        let totalValue = 0;

        if (!this.payerUtxos.length) {
            throw new Error("Send some BTC to this address to generate the dummy utxo");
        }

        for (const utxo of this.payerUtxos) {
            const tx = bitcoin.Transaction.fromHex(await this.getTxHexById(utxo.txid));
            for (const output in tx.outs) {
                try {
                    tx.setWitness(parseInt(output), []);
                } catch {}
            }
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                // nonWitnessUtxo: tx.toBuffer(),
                witnessUtxo: {
                    value: utxo.value,
                    script: inputAddressInfo.output,
                },
                tapInternalKey: toXOnly(publicKey),
            });

            totalValue += utxo.value;
        }

        for (let i = 0; i < numberOfDummyUtxosToCreate; i++) {
            psbt.addOutput({
                address: payerAddress,
                value: dummyUtxoValue,
            });
        }

        const fee = calculateFee(psbt.txInputs.length, psbt.txOutputs.length, await recommendedFeeRate);

        // Change utxo
        psbt.addOutput({
            address: payerAddress,
            value: totalValue - numberOfDummyUtxosToCreate * dummyUtxoValue - fee,
        });

        const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
            0,
            [inputAddressInfo.output],
            [totalValue],
            bitcoin.Transaction.SIGHASH_DEFAULT
        );

        const sig = await window.nostr.signSchnorr(sigHash.toString("hex"));
        psbt.updateInput(0, {
            tapKeySig: serializeTaprootSignature(Buffer.from(sig, "hex")),
        });

        psbt.finalizeAllInputs();

        const tx = psbt.extractTransaction();
        const hex = tx.toBuffer().toString("hex");
        const fullTx = bitcoin.Transaction.fromHex(hex);

        await axios.post(`${MEMPOOL_BASE_URL}/api/tx`, hex);

        return fullTx.getId();
    }

    async updatePayerAddress(payerAddress) {
        window.localStorage.setItem("payerAddress", payerAddress); // TODO: Use service

        try {
            this.payerUtxos = await getAddressUtxos(payerAddress);
        } catch (e) {
            throw new Error("missing dummy utxo");
        }

        const potentialDummyUtxos = this.payerUtxos.filter((utxo) => utxo.value <= dummyUtxoValue);
        this.dummyUtxo = undefined;

        for (const potentialDummyUtxo of potentialDummyUtxos) {
            if (!(await doesUtxoContainInscription(potentialDummyUtxo))) {
                // hideDummyUtxoElements();
                this.dummyUtxo = potentialDummyUtxo;
                break;
            }
        }

        let minimumValueRequired;
        let vins;
        let vouts;

        if (!this.dummyUtxo) {
            // showDummyUtxoElements();
            minimumValueRequired = numberOfDummyUtxosToCreate * dummyUtxoValue;
            vins = 0;
            vouts = numberOfDummyUtxosToCreate;
        } else {
            // hideDummyUtxoElements();
            minimumValueRequired = price + numberOfDummyUtxosToCreate * dummyUtxoValue;
            vins = 1;
            vouts = 2 + numberOfDummyUtxosToCreate;
        }

        try {
            this.paymentUtxos = await selectUtxos(
                this.payerUtxos,
                minimumValueRequired,
                vins,
                vouts,
                await recommendedFeeRate
            );
        } catch (e) {
            this.paymentUtxos = undefined;
            throw e;
        }
    }

    async generatePSBTBuyingInscription(payerAddress, receiverAddress, price) {
        const psbt = new bitcoin.Psbt({ network });
        let totalValue = 0;
        let totalPaymentValue = 0;

        // Add dummy utxo input
        const tx = bitcoin.Transaction.fromHex(await this.getTxHexById(this.dummyUtxo.txid));
        for (const output in tx.outs) {
            try {
                tx.setWitness(parseInt(output), []);
            } catch {}
        }
        psbt.addInput({
            hash: this.dummyUtxo.txid,
            index: this.dummyUtxo.vout,
            nonWitnessUtxo: tx.toBuffer(),
            // witnessUtxo: tx.outs[this.dummyUtxo.vout],
        });

        // Add inscription output
        psbt.addOutput({
            address: receiverAddress,
            value: this.dummyUtxo.value + Number(inscription["output value"]),
        });

        // Add payer signed input
        psbt.addInput({
            ...sellerSignedPsbt.data.globalMap.unsignedTx.tx.ins[0],
            ...sellerSignedPsbt.data.inputs[0],
        });
        // Add payer output
        psbt.addOutput({
            ...sellerSignedPsbt.data.globalMap.unsignedTx.tx.outs[0],
        });

        // Add payment utxo inputs
        for (const utxo of this.paymentUtxos) {
            const tx = bitcoin.Transaction.fromHex(await this.getTxHexById(utxo.txid));
            for (const output in tx.outs) {
                try {
                    tx.setWitness(parseInt(output), []);
                } catch {}
            }

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: tx.toBuffer(),
                // witnessUtxo: tx.outs[utxo.vout],
            });

            totalValue += utxo.value;
            totalPaymentValue += utxo.value;
        }

        // Create a new dummy utxo output for the next purchase
        psbt.addOutput({
            address: payerAddress,
            value: dummyUtxoValue,
        });

        const fee = calculateFee(psbt.txInputs.length, psbt.txOutputs.length, await recommendedFeeRate);

        const changeValue = totalValue - this.dummyUtxo.value - price - fee;

        if (changeValue < 0) {
            throw `Your wallet address doesn't have enough funds to buy this inscription.
Price:          ${satToBtc(price)} BTC
Fees:       ${satToBtc(fee + dummyUtxoValue)} BTC
You have:   ${satToBtc(totalPaymentValue)} BTC
Required:   ${satToBtc(totalValue - changeValue)} BTC
Missing:     ${satToBtc(-changeValue)} BTC`;
        }

        // Change utxo
        psbt.addOutput({
            address: payerAddress,
            value: changeValue,
        });

        return psbt.toBase64();
    }
}

const OpenOrdex = new OpenOrdexFactory();

export { OpenOrdex };
