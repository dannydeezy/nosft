import ScrollToTop from "@ui/scroll-to-top";
import PropTypes from "prop-types";
import { ToastContainer } from "react-toastify";

const Wrapper = ({ children }) => (
    <>
        {children}
        <ScrollToTop />
        <ToastContainer theme="dark" autoClose={1500} pauseOnHover={false} pauseOnFocusLoss={false} />
    </>
);

Wrapper.propTypes = {
    children: PropTypes.node.isRequired,
};

export default Wrapper;
