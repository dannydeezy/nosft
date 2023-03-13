/* eslint-disable react/forbid-prop-types */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import Button from "@ui/button";
import { validate, Network } from "bitcoin-address-validation";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import { TESTNET, DEFAULT_FEE_RATE, ORDINALS_EXPLORER_URL, MEMPOOL_BASE_URL } from "@lib/constants.config";
import { shortenStr, outputValue, getAddressInfo } from "@utils/crypto";
import SessionStorage, { SessionsStorageKeys } from "@services/session-storage";
import { serializeTaprootSignature } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { TailSpin } from "react-loading-icons";
import { IframeWithLoader } from "@components/iframe";
import Lottie from "lottie-react";
import Anchor from "@ui/anchor";
import sendAnimation from "../../../assets/animations/sent-successfully-plane.json";

const axios = require("axios");

bitcoin.initEccLib(ecc);

const SendModal = ({ show, handleModal, utxo, onSale }) => {
    const [isBtcInputAddressValid, setIsBtcInputAddressValid] = useState(true);
    const [destinationBtcAddress, setDestinationBtcAddress] = useState("");
    const [sendFeeRate, setSendFeeRate] = useState(DEFAULT_FEE_RATE);
    const [sentTxid, setSentTxid] = useState(null);
    const [nostrPublicKey, setNostrPublicKey] = useState();
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const pubKey = SessionStorage.get(SessionsStorageKeys.NOSTR_PUBLIC_KEY);
        if (pubKey) {
            setNostrPublicKey(pubKey);
        }
    }, []);

    function toXOnly(key) {
        return key.length === 33 ? key.slice(1, 33) : key;
    }

    async function sendUtxo() {
        const inputAddressInfo = getAddressInfo(nostrPublicKey);
        const psbt = new bitcoin.Psbt({
            network: TESTNET ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
        });
        const publicKey = Buffer.from(await window.nostr.getPublicKey(), "hex");
        const inputParams = {
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                value: utxo.value,
                script: inputAddressInfo.output,
            },
            tapInternalKey: toXOnly(publicKey),
        };
        psbt.addInput(inputParams);
        psbt.addOutput({
            address: destinationBtcAddress,
            value: outputValue(utxo, sendFeeRate),
        });
        const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
            0,
            [inputAddressInfo.output],
            [utxo.value],
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
        console.log("hex", hex, "txid", fullTx.getId());
        try {
            await axios.post(`${MEMPOOL_BASE_URL}/api/tx`, hex);
            return true;
        } catch (error) {
            console.error(error);
            return null;
        } finally {
            setSentTxid(fullTx.getId());
        }
    }

    return (
        <Modal className="rn-popup-modal placebid-modal-wrapper" show={show} onHide={handleModal} centered>
            {show && (
                <button type="button" className="btn-close" aria-label="Close" onClick={handleModal}>
                    <i className="feather-x" />
                </button>
            )}
            <Modal.Header>
                {!sentTxid && <h3 className="modal-title">Send {shortenStr(utxo && `${utxo.txid}:${utxo.vout}`)}</h3>}
            </Modal.Header>
            <Modal.Body>
                {!sentTxid ? (
                    <>
                        <p>You are about to send this ordinal</p>
                        <IframeWithLoader
                            id="preview"
                            sandbox="allow-scripts allow-same-origin"
                            scrolling="no"
                            loading="lazy"
                            title={utxo.inscriptionId}
                            src={`${ORDINALS_EXPLORER_URL}/preview/${utxo.inscriptionId}`}
                        />

                        <div className="placebid-form-box">
                            <div className="bid-content">
                                <div className="bid-content-top">
                                    <div className="bid-content-left">
                                        <InputGroup className="mb-lg-5">
                                            <Form.Control
                                                onChange={(evt) => {
                                                    const newaddr = evt.target.value;

                                                    if (newaddr === "") {
                                                        setIsBtcInputAddressValid(true);
                                                        return;
                                                    }
                                                    if (
                                                        !validate(newaddr, TESTNET ? Network.testnet : Network.mainnet)
                                                    ) {
                                                        setIsBtcInputAddressValid(false);
                                                        return;
                                                    }

                                                    setIsBtcInputAddressValid(true);
                                                    setDestinationBtcAddress(newaddr);
                                                }}
                                                placeholder="Paste BTC address here"
                                                aria-label="Paste BTC address heres"
                                                aria-describedby="basic-addon2"
                                                isInvalid={!isBtcInputAddressValid}
                                                autoFocus
                                            />

                                            <Form.Control.Feedback type="invalid">
                                                <br />
                                                That is not a valid {TESTNET ? "testnet" : "mainnet"} BTC address
                                            </Form.Control.Feedback>
                                        </InputGroup>
                                        <InputGroup className="mb-3">
                                            <Form.Label>Select a fee rate</Form.Label>
                                            <Form.Range
                                                min="1"
                                                max="100"
                                                defaultValue={sendFeeRate}
                                                onChange={(evt) => setSendFeeRate(evt.target.value)}
                                            />
                                        </InputGroup>
                                    </div>
                                </div>

                                <div className="bid-content-mid">
                                    <div className="bid-content-left">
                                        {!!destinationBtcAddress && <span>Destination</span>}
                                        <span>Fee rate</span>
                                        <span>Output Value</span>
                                    </div>
                                    <div className="bid-content-right">
                                        {!!destinationBtcAddress && <span>{shortenStr(destinationBtcAddress)}</span>}
                                        <span>{sendFeeRate} sat/vbyte</span>
                                        <span>{utxo && sendFeeRate && outputValue(utxo, sendFeeRate)} sats</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bit-continue-button">
                                <Button
                                    size="medium"
                                    fullwidth
                                    disabled={!destinationBtcAddress}
                                    className={isSending ? "btn-loading" : ""}
                                    onClick={async () => {
                                        setIsSending(true);
                                        await sendUtxo().catch((err) => {
                                            console.error(err);
                                            alert(err);
                                            return false;
                                        });

                                        // sleep for 1 second to let the tx propagate
                                        await new Promise((r) => {
                                            setTimeout(r, 1000);
                                        });
                                        onSale();

                                        setIsSending(false);
                                    }}
                                >
                                    {isSending ? <TailSpin stroke="#fec823" speed={0.75} /> : "Send"}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center">
                        <Lottie animationData={sendAnimation} loop={false} />
                        Transaction sent:
                        <Anchor className="btn btn-small" path={`${MEMPOOL_BASE_URL}/tx/${sentTxid}`} target="_blank">
                            {shortenStr(sentTxid)}
                        </Anchor>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

SendModal.propTypes = {
    show: PropTypes.bool.isRequired,
    handleModal: PropTypes.func.isRequired,
    utxo: PropTypes.object,
    onSale: PropTypes.func.isRequired,
};
export default SendModal;
