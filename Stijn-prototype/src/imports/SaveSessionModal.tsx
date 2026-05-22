import { useState } from 'react';

interface SaveSessionModalProps {
  onClose: () => void;
  onSave: () => void;
}

export function SaveSessionModal({ onClose, onSave }: SaveSessionModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate NFC write (in production, this would trigger actual NFC writer)
    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccessfully(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-gradient-to-br from-emerald-900 to-green-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-emerald-600/50 shadow-2xl">
        {!savedSuccessfully ? (
          <>
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                {isSaving ? (
                  <svg className="w-12 h-12 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
                  </svg>
                )}
              </div>
              <h2 className="text-2xl font-bold text-emerald-100 mb-2">
                {isSaving ? 'Writing to Card...' : 'Save Your Session'}
              </h2>
              <p className="text-emerald-300/80 text-sm">
                {isSaving
                  ? 'Please keep your NFC card/tag near the device'
                  : 'Write your current session to your NFC card or tag to resume later'}
              </p>
            </div>

            {isSaving && (
              <div className="mb-6">
                <div className="w-full bg-emerald-950/50 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-green-500 h-full animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-emerald-500/50 flex items-center justify-center gap-3 ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Writing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>Save to NFC Card/Tag</span>
                  </>
                )}
              </button>

              {!isSaving && (
                <button
                  onClick={onClose}
                  className="w-full px-6 py-3 bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 rounded-xl transition-all duration-300 font-medium hover:scale-105 active:scale-95"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg animate-pulse">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-emerald-100 mb-2">Session Saved!</h2>
            <p className="text-emerald-300/80 text-sm">
              Your session has been successfully written to your NFC card/tag
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
