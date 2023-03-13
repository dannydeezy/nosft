/* eslint-disable react/forbid-prop-types */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-extra-boolean-cast */
import { useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import SectionTitle from "@components/section-title";
import OrdinalCard from "@components/ordinal-card";
import { deepClone } from "@utils/methods";
import OpenOrdex from "@utils/openOrdexV3";
import LocalStorage, { LocalStorageKeys } from "@services/local-storage";
import WalletContext from "@context/wallet-context";
// Use this to fetch data from an API service
const axios = require("axios");

const collectionAuthor = [
    {
        name: "Danny Deezy",
        slug: "/deezy",
        image: {
            src: "/images/logo/nos-ft-logo.png",
        },
    },
];

const OnSaleOrdinalsArea = ({ className, space, onConnectHandler, onSale }) => {
    const { nostrAddress, isExperimental } = useContext(WalletContext);
    const [openOrders, setOpenOrders] = useState([]);
    const [isLoadingOpenOrders, setIsLoadingOpenOrders] = useState(true);

    useEffect(() => {
        console.log("OnSaleOrdinalsArea useEffect");
        // safe on session storage for faster loads
        window.addEventListener("message", (event) => {
            console.debug(event);
        });
        const load = async () => {
            setIsLoadingOpenOrders(true);
            // load from cache before updating
            const sessionOrders = LocalStorage.get(LocalStorageKeys.INSCRIPTIONS_ON_SALE);
            if (sessionOrders) {
                setOpenOrders(sessionOrders);
            }
            const openOrderx = await OpenOrdex.init();
            const orders = await openOrderx.getLatestOrders(25);

            const forSaleInscriptions = [];
            for (const inscription of orders) {
                let inscriptionData = inscription.tags
                    // .filter(([t, v]) => t === "i" && v)
                    .map(([tagId, value]) => ({
                        [tagId]: value,
                    }));
                // Convert array into object of key tagId
                inscriptionData = Object.assign({}, ...inscriptionData.map((o) => o));

                const i = deepClone({
                    inscriptionTags: inscriptionData,
                    ...inscription,
                });
                // console.log(i);

                forSaleInscriptions.push(i);
            }

            LocalStorage.set(LocalStorageKeys.INSCRIPTIONS_ON_SALE, forSaleInscriptions);

            setOpenOrders(forSaleInscriptions);

            setIsLoadingOpenOrders(false);
        };
        load();
    }, []);

    return (
        <div id="selling-collection" className={clsx("rn-product-area", space === 1 && "rn-section-gapTop", className)}>
            <div className="container">
                <div className="row mb--50 align-items-center">
                    <div className="col-lg-6 col-md-6 col-sm-6 col-12">
                        <SectionTitle
                            className="mb--0 with-loading"
                            isLoading={isLoadingOpenOrders}
                            {...{ title: "On sale" }}
                        />
                        {!Boolean(nostrAddress) && isExperimental && (
                            <span>
                                <button type="button" className="btn-transparent" onClick={onConnectHandler}>
                                    Connect
                                </button>{" "}
                                your wallet to buy an inscription
                            </span>
                        )}
                    </div>
                </div>

                {!!openOrders.length && (
                    <div className="row g-5">
                        {openOrders.length > 0 ? (
                            <>
                                {openOrders.map((utxo) => (
                                    <div key={utxo.id} className="col-5 col-lg-4 col-md-6 col-sm-6 col-12">
                                        <OrdinalCard
                                            overlay
                                            price={{
                                                amount: utxo.value.toLocaleString("en-US"),
                                                currency: "Sats",
                                            }}
                                            type="buy"
                                            confirmed
                                            date={utxo.created_at}
                                            authors={collectionAuthor}
                                            utxo={utxo}
                                            onSale={onSale}
                                        />
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div>There are no inscriptions for sale yet..</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

OnSaleOrdinalsArea.propTypes = {
    className: PropTypes.string,
    space: PropTypes.oneOf([1, 2]),
    onClick: PropTypes.func,
    onSale: PropTypes.func,
    onConnectHandler: PropTypes.func,
};

OnSaleOrdinalsArea.defaultProps = {
    space: 1,
};

export default OnSaleOrdinalsArea;
