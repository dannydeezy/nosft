/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */

import { useState, useEffect, useMemo, useRef } from "react";
import Wrapper from "@layout/wrapper";
import Header from "@layout/header";
import Footer from "@layout/footer";
import SEO from "@components/seo";
import HeroArea from "@containers/HeroArea";
import OrdinalsArea from "@containers/OrdinalsArea";
import { normalizedData, getQueryStringParam } from "@utils/methods";
import { getAddressInfo } from "@utils/crypto";
import homepageData from "@data/general/home.json";
import { useConnectWallet } from "@hooks";
import WalletContext from "@context/wallet-context";
import OnSaleOrdinalsArea from "@containers/OnSaleOrdinalsArea";

export async function getStaticProps() {
    return { props: { className: "template-color-1" } };
}

const App = () => {
    const [isExperimental, setIsExperimental] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(148); // Optimistically
    const elementRef = useRef(null);

    const [nostrAddress, setNostrAddress] = useState();
    const { nostrPublicKey, onConnectHandler, onDisconnectHandler } = useConnectWallet();

    useEffect(() => {
        const exp = getQueryStringParam("__mode");
        if (exp === "astral") {
            setIsExperimental(true);
        }
        if (elementRef.current) {
            setHeaderHeight(elementRef.current.clientHeight);
        }
    }, []);

    useEffect(() => {
        if (!nostrPublicKey) return;

        const { address } = getAddressInfo(nostrPublicKey);
        setNostrAddress(address);
    }, [nostrPublicKey]);

    const content = normalizedData(homepageData?.content || []);

    const obj = useMemo(
        () => ({
            nostrPublicKey,
            nostrAddress,
            isExperimental,
        }),
        [nostrPublicKey, nostrAddress, isExperimental]
    );

    const [refreshHack, setRefreshHack] = useState(false);

    return (
        <WalletContext.Provider value={obj}>
            <Wrapper>
                <SEO pageTitle="Deezy" />
                <Header
                    ref={elementRef}
                    nostrPublicKey={nostrPublicKey}
                    onConnectHandler={onConnectHandler}
                    onDisconnectHandler={onDisconnectHandler}
                    address={nostrAddress}
                />
                <main id="main-content" style={{ paddingTop: headerHeight }}>
                    {!nostrPublicKey && <HeroArea data={content["hero-section"]} onConnectHandler={onConnectHandler} />}

                    {nostrPublicKey && nostrAddress && <OrdinalsArea />}

                    <OnSaleOrdinalsArea onConnectHandler={onConnectHandler} onSale={setRefreshHack} />
                </main>

                <Footer />
            </Wrapper>
        </WalletContext.Provider>
    );
};

export default App;
