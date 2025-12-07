// App.js
import React, { useState } from "react";
import TicTacToe from "./components/TicTacToe.jsx";
import "./App.css";
import Input from "./components/input.jsx";

export default function App() {
  const [name, setName] = useState("");

  return (
    <div>
      {!name ? (
        <Input setName={setName} />
      ) : (
        <TicTacToe name={name} />
      )}
    </div>
  );
}
