/* eslint-disable react/forbid-prop-types */
import PropTypes from "prop-types";
import { useState, useContext } from "react";
import SendModal from "@components/modals/send-modal";
import SellModal from "@components/modals/sell-modal";
import BuyModal from "@components/modals/buy-modal";
import WalletContext from "@context/wallet-context";

const ProductBid = ({ price, utxo, confirmed, date, type, onSale }) => {
    const { nostrAddress, isExperimental } = useContext(WalletContext);
    const [showSendModal, setShowSendModal] = useState(false);
    const handleSendModal = () => {
        setShowSendModal((prev) => !prev);
    };

    const [showSellModal, setShowSellModal] = useState(false);
    const handleSellModal = () => {
        setShowSellModal((prev) => !prev);
    };

    const [showBuyModal, setShowBuyModal] = useState(false);
    const handleBuyModal = () => {
        setShowBuyModal((prev) => !prev);
    };

    function renderMainAction(actionType) {
        switch (actionType) {
            case "buy":
                if (!isExperimental) return <span />;
                return (
                    <button type="button" className="btn btn-small" onClick={handleBuyModal} disabled={!confirmed}>
                        Buy
                    </button>
                );
            case "sell":
                if (!isExperimental) return <span />;
                return (
                    <button type="button" className="btn btn-small" onClick={handleSellModal} disabled={!confirmed}>
                        Sell
                    </button>
                );
            case "send":
                return (
                    <button type="button" className="btn btn-small" onClick={handleSendModal} disabled={!confirmed}>
                        Send
                    </button>
                );
            default:
                return <span />;
        }
    }
    const minted = !confirmed ? "Unconfirmed" : new Date(date * 1000).toLocaleString();

    return (
        <div className="bid-react-area">
            <div className="last-bid">
                {`${price.amount} ${price.currency}`}
                <span className="minted">{` ${minted}`}</span>
            </div>

            {Boolean(nostrAddress) && renderMainAction(type)}

            <SendModal show={showSendModal} handleModal={handleSendModal} utxo={utxo} onSale={onSale} />

            <SellModal show={showSellModal} handleModal={handleSellModal} utxo={utxo} onSale={onSale} />

            <BuyModal show={showBuyModal} handleModal={handleBuyModal} utxo={utxo} onSale={onSale} />
        </div>
    );
};

ProductBid.propTypes = {
    price: PropTypes.shape({
        amount: PropTypes.string.isRequired,
        currency: PropTypes.string.isRequired,
    }).isRequired,
    utxo: PropTypes.object,
    confirmed: PropTypes.bool,
    date: PropTypes.number,
    type: PropTypes.oneOf(["buy", "sell", "send"]).isRequired,
    onSale: PropTypes.func,
};

export default ProductBid;
