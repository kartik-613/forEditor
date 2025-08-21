import React, { useState } from "react";

export default function CertificatePopup({ onSave, kk }) {
  const [showPopup, setShowPopup] = useState(false);
  const [title, setTitle] = useState("");

  const handleSaveClick = () => {
    if (!title.trim()) {
      alert("Title is required!");
      return;
    }
    onSave(title); // send title to parent
    setShowPopup(false); // close popup
    setTitle(""); // reset
  };

  return (
      <>
      {/* Button to open popup */}
      <button
        onClick={() => setShowPopup(true)}
        className={`${kk}`}
      >
        💾 Save
      </button>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-blue/40 backdrop-blur-sm bg-opacity-50 z-80">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">
              Enter Certificate Title
            </h2>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Certificate title"
              className="w-full border rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-green-500 outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPopup(false)}
                className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClick}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </>
  );
}
