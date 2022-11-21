import React from "react";
import reactLogo from "../assets/react.svg";

type Props = {};

const Header = (props: Props) => {
  return (
    <div>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>_underscore</h1>
    </div>
  );
};

export default Header;
