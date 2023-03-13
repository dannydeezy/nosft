/* eslint-disable react/forbid-prop-types */
import { useState, useContext, useEffect } from "react";
import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import Button from "@ui/button";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import { ORDINALS_EXPLORER_URL } from "@lib/constants.config";
import { shortenStr } from "@utils/crypto";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import WalletContext from "@context/wallet-context";
import { OpenOrdex } from "@utils/openOrdex";
import { TailSpin } from "react-loading-icons";

// import {
//     getInscriptionDataById,
//     generatePSBTListingInscriptionForSale,
//     updatePayerAddress,
//     hideDummyUtxoElements,
//     generatePSBTGeneratingDummyUtxos,
//     numberOfDummyUtxosToCreate,
//     paymentUtxos,
//     generatePSBTBuyingInscription,
// } from "@utils/openOrdex";
import { toast } from "react-toastify";
import { IframeWithLoader } from "@components/iframe";

bitcoin.initEccLib(ecc);

const BuyModal = ({ show, handleModal, utxo }) => {
    const { nostrAddress } = useContext(WalletContext);
    const [isBtcInputAddressValid, setIsBtcInputAddressValid] = useState(true);
    const [isBtcAmountValid, setIsBtcAmountValid] = useState(true);
    const [destinationBtcAddress, setDestinationBtcAddress] = useState(nostrAddress);
    const [ordinalValue, setOrdinalValue] = useState(utxo.value);
    const [isOnBuy, setIsOnBuy] = useState(false);

    let openOrderx;

    const createDummyUtxo = async () => {
        try {
            const txId = await openOrderx.generatePSBTGeneratingDummyUtxos(destinationBtcAddress);
            toast.info(`Transaction created. Please wait for it to be confirmed. TxId: ${txId}`);
        } catch (e) {
            toast.error(e.message);
        }
    };

    const updatePayerAddress = async (address) => {
        if (!openOrderx) {
            openOrderx = await OpenOrdex.init();
        }

        try {
            await openOrderx.updatePayerAddress(address);
        } catch (e) {
            toast.error(e.message);
            if (window.confirm("Create dummy UTXO?")) {
                await createDummyUtxo();
            }
        }
    };

    const onChangeAddress = async (newaddr) => {
        if (newaddr === "") {
            setIsBtcInputAddressValid(true);
            return;
        }

        try {
            setDestinationBtcAddress(newaddr);
        } catch (e) {
            setIsBtcInputAddressValid(false);
            toast.error(e.message);
        }

        try {
            await updatePayerAddress(newaddr);
        } catch (e) {
            if (e.message === "missing dummy utxo") {
                toast.error("This address does not contain any valid UTXOs. Please try create one before continue.");

                if (window.confirm("Create dummy UTXO?")) {
                    await createDummyUtxo();
                }
            }
        }
    };

    useEffect(() => {
        setDestinationBtcAddress(nostrAddress);
        const updateAddress = async () => {
            await OpenOrdex.init();
            // await updatePayerAddress(nostrAddress);
        };

        updateAddress();
    }, [nostrAddress]);

    const buy = async () => {
        setIsOnBuy(true);

        if (!openOrderx) {
            openOrderx = await OpenOrdex.init();
        }

        await onChangeAddress(destinationBtcAddress);

        try {
            const psbt = await openOrderx.generatePSBTBuyingInscription(
                destinationBtcAddress,
                destinationBtcAddress,
                utxo.value
            );
            console.log(psbt);
            return psbt;
        } catch (e) {
            toast.error(e.message);
        }
        // Sign and send
        setIsOnBuy(false);

        return undefined;
    };

    return (
        <Modal className="rn-popup-modal placebid-modal-wrapper" show={show} onHide={handleModal} centered>
            {show && (
                <button type="button" className="btn-close" aria-label="Close" onClick={handleModal}>
                    <i className="feather-x" />
                </button>
            )}
            <Modal.Header>
                <h3 className="modal-title">Buy {shortenStr(utxo && `${utxo.inscriptionId}`)}</h3>
            </Modal.Header>
            <Modal.Body>
                <p>You are about to buy this Ordinal</p>
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
                                <InputGroup className="mb-lg-5 notDummy">
                                    <Form.Label>Address to receive payment</Form.Label>
                                    <Form.Control
                                        defaultValue={nostrAddress}
                                        onChange={async (evt) => {
                                            const newaddr = evt.target.value;

                                            await onChangeAddress(newaddr);
                                        }}
                                        placeholder="Buyer address"
                                        aria-label="Buyer address"
                                        aria-describedby="basic-addon2"
                                        isInvalid={!isBtcInputAddressValid}
                                        autoFocus
                                    />

                                    <Form.Control.Feedback type="invalid">
                                        <br />
                                        No dummy UTXOs found for your address
                                    </Form.Control.Feedback>
                                </InputGroup>
                            </div>
                        </div>

                        <div className="bid-content-mid">
                            <div className="bid-content-left">
                                {Boolean(destinationBtcAddress) && <span>Payment Receive Address</span>}

                                {Boolean(utxo.usdPrice) && <span>Price</span>}
                            </div>
                            <div className="bid-content-right">
                                {Boolean(destinationBtcAddress) && <span>{shortenStr(destinationBtcAddress)}</span>}

                                {Boolean(utxo.usdPrice) && <span>{utxo.usdPrice}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="bit-continue-button notDummy">
                        <Button
                            size="medium"
                            fullwidth
                            disabled={!destinationBtcAddress}
                            autoFocus
                            className={isOnBuy ? "btn-loading" : ""}
                            onClick={async () => {
                                if (!destinationBtcAddress) return;
                                if (!isBtcAmountValid) return;
                                if (!isBtcInputAddressValid) return;

                                try {
                                    const msg = `Are you sure you want to buy this ordinal for ${ordinalValue} sats?`;
                                    if (!window.confirm(msg)) return;

                                    await buy();
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                        >
                            {isOnBuy ? <TailSpin stroke="#fec823" speed={0.75} /> : "Buy"}
                        </Button>
                    </div>

                    {/* <div className="bit-continue-button dummy">
                        <Button
                            size="medium"
                            fullwidth
                            disabled={!destinationBtcAddress}
                            autoFocus
                            onClick={async () => {
                                await createDummyUtxo();
                            }}
                        >
                            Create dummy Utxo
                        </Button>
                    </div> */}
                </div>
            </Modal.Body>
        </Modal>
    );
};

BuyModal.propTypes = {
    show: PropTypes.bool.isRequired,
    handleModal: PropTypes.func.isRequired,
    utxo: PropTypes.object,
};
export default BuyModal;
