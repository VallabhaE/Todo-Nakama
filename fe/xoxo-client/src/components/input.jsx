import React, { useState } from "react";

export default function Input({ setName }) {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = () => {
    const newName = inputValue.trim();
    if (newName === "") {
      alert("Please enter your name!");
      return;
    }
    setName(newName);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="bg-white shadow-2xl rounded-2xl p-8 w-96 transform transition-all hover:scale-[1.02] duration-300">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Enter Your Name
        </h1>

        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type your name..."
          className="w-full text-black px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-300"
        />

        <div className="flex justify-center mt-6">
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-300"
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
