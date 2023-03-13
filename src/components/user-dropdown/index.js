import PropTypes from "prop-types";
import Image from "next/image";
import Anchor from "@ui/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const UserDropdown = ({ onDisconnect, receiveAddress }) => (
    <div className="icon-box">
        <Anchor path="#">
            <Image src="/images/logo/nos-ft-logo.png" alt="Images" width={38} height={38} />
        </Anchor>
        <div className="rn-dropdown">
            <div className="rn-product-inner">
                <ul className="product-list">
                    <li className="single-product-list">
                        <div className="content">
                            <h6 className="title">
                                Receive Address
                                <span className="icon">
                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Copy receive address to clipboard"
                                        onClick={() => {
                                            navigator.clipboard.writeText(receiveAddress);
                                            toast("Receive Address copied to clipboard!");
                                        }}
                                    >
                                        <i className="feather-copy" />
                                    </button>
                                </span>
                            </h6>
                            <span className="text">
                                You can safely receive ordinal inscriptions and regular bitcoin to this address
                            </span>
                            {/* Add copy to clipboard button */}
                            <span className="receiveAddress">{receiveAddress}</span>
                        </div>
                        <div className="button" />
                    </li>
                    {/* <li className="single-product-list">
                        <div className="content">
                            <h6 className="title">
                                Public Key
                                <span className="icon">
                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Copy receive address to clipboard"
                                        onClick={() => {
                                            navigator.clipboard.writeText(
                                                pubKey
                                            );
                                            toast(
                                                "Public key copied to clipboard!"
                                            );
                                        }}
                                    >
                                        <i className="feather-copy" />
                                    </button>
                                </span>
                            </h6>
                            <span className="text">{pubKey}</span>
                        </div>
                        <div className="button" />
                    </li> */}
                </ul>
            </div>

            <ul className="list-inner">
                <li>
                    <button type="button" onClick={onDisconnect}>
                        Disconnect Wallet
                    </button>
                </li>
            </ul>
        </div>
    </div>
);

UserDropdown.propTypes = {
    onDisconnect: PropTypes.func.isRequired,
    receiveAddress: PropTypes.string,
};

export default UserDropdown;
