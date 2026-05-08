import ReactDOM from "react-dom/client";
import App from "./App";
import Pair from "./Pair";
import "./styles.css";

const path = window.location.pathname;
const Root = path === "/pair" || path.startsWith("/pair/") ? Pair : App;

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
