/* eslint-disable react/forbid-prop-types */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-extra-boolean-cast */
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import SectionTitle from "@components/section-title";
import OrdinalCard from "@components/ordinal-card";
import { deepClone } from "@utils/methods";
import WalletContext from "@context/wallet-context";
import { nostrPool } from "@services/nostr-relay";
import { MAX_ONSALE } from "@lib/constants.config";
import { Subject } from "rxjs";
import { scan } from "rxjs/operators";

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
    const [isLoadingOpenOrders, setIsLoadingOpenOrders] = useState(false); // it is necessary?
    const addOpenOrder$ = useRef(new Subject());
    const addSubscriptionRef = useRef(null);
    const orderSubscriptionRef = useRef(null);
    const [isWindowFocused, setIsWindowFocused] = useState(true);

    const formatOrder = (inscription) => {
        const inscriptionData = Object.assign(
            {},
            ...inscription.tags
                .map(([tagId, value]) => ({
                    [tagId]: value,
                }))
                .map((o) => o)
        );
        const forSaleInscription = deepClone({
            inscriptionTags: inscriptionData,
            ...inscription,
        });
        return forSaleInscription;
    };

    const addNewOpenOrder = (order) => {
        addOpenOrder$.current.next(formatOrder(order));
    };

    useEffect(() => {
        if (isWindowFocused) {
            addSubscriptionRef.current = addOpenOrder$.current
                .pipe(
                    scan((acc, curr) => {
                        // We can add only unique ordinals by id or inscriptionId
                        // I keep if for test purposes
                        if (acc.find((order) => order.id === curr.id)) {
                            return acc;
                        }
                        // We sort by created_at DESC and limit list
                        return [...acc, curr].sort((a, b) => b.created_at - a.created_at).slice(0, MAX_ONSALE);
                    }, openOrders)
                )
                .subscribe(setOpenOrders);
            orderSubscriptionRef.current = nostrPool.subscribeOrders({ limit: MAX_ONSALE }).subscribe(addNewOpenOrder);
        }
        return () => {
            try {
                orderSubscriptionRef?.current?.unsubscribe();
                addSubscriptionRef?.current?.unsubscribe();
                // eslint-disable-next-line no-empty
            } catch (err) {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWindowFocused]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsWindowFocused(!document.hidden);
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return (
        <div id="selling-collection" className={clsx("rn-product-area", space === 1 && "rn-section-gapTop", className)}>
            <div className="container">
                <div className="row mb--50 align-items-center">
                    <div className="col-lg-6 col-md-6 col-sm-6 col-12">
                        <SectionTitle
                            className="mb--0 with-loading"
                            isLoading={isLoadingOpenOrders}
                            {...{ title: "On Sale" }}
                            subtitle="Buy & sell comming soon"
                        />
                        <span>Buy and sell comming soon</span>
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
