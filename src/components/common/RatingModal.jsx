import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { submitRating } from '../../Redux/ratingSlice';

const EMOJI_RATINGS = [
  { score: 1, emoji: '😞', label: 'Terrible' },
  { score: 2, emoji: '😕', label: 'Bad' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '😊', label: 'Good' },
  { score: 5, emoji: '🤩', label: 'Excellent!' },
];

export default function RatingModal({
  isOpen,
  onClose,
  darkMode,
  orderId,
  chatId,
  runnerId,
  runnerName,
  runnerAvatar,
  socket
}) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.rating);

  const [selectedScore, setSelectedScore] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hoveredScore, setHoveredScore] = useState(null);

  const handleSubmit = async () => {
    if (!selectedScore) {
      alert('Please select a rating');
      return;
    }

    try {
      await dispatch(submitRating({
        orderId,
        chatId,
        runnerId,
        rating: selectedScore,
        feedback: feedback.trim() || null
      })).unwrap();

      // Also emit via socket
      if (socket) {
        socket.emit('submitRating', {
          orderId,
          chatId,
          runnerId,
          rating: selectedScore,
          feedback: feedback.trim() || null
        });
      }

      setSubmitted(true);
    } catch (error) {
      alert(error || 'Failed to submit rating');
    }
  };

  if (!isOpen) return null;

  const activeScore = hoveredScore || selectedScore;
  const activeEmoji = EMOJI_RATINGS.find(r => r.score === activeScore);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-t-3xl ${
        darkMode ? 'bg-black-100' : 'bg-white'
      }`}>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`} />
        </div>

        {/* Close button */}
        <div className="flex justify-end px-6 pt-2">
          <button onClick={onClose}>
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="px-6 pb-8">

          {/* Success State */}
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <span className="text-6xl">🎉</span>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Thanks for rating!
              </h3>
              <p className={`text-sm text-center ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Your feedback helps improve the service for everyone.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Runner info */}
              <div className="flex flex-col items-center mb-6">
                <h2 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Rate your experience
                </h2>
                <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  How was your delivery with {runnerName}?
                </p>
              </div>

              {/* Emoji Rating */}
              <div className="flex justify-center gap-3 mb-4">
                {EMOJI_RATINGS.map(({ score, emoji }) => (
                  <button
                    key={score}
                    onClick={() => setSelectedScore(score)}
                    onMouseEnter={() => setHoveredScore(score)}
                    onMouseLeave={() => setHoveredScore(null)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${
                      selectedScore === score
                        ? 'bg-primary/20 scale-110'
                        : darkMode
                          ? 'hover:bg-black-200'
                          : 'hover:bg-gray-1001'
                    }`}
                  >
                    <span className={`text-3xl transition-all ${
                      selectedScore === score ? 'scale-125' : ''
                    }`}>
                      {emoji}
                    </span>
                  </button>
                ))}
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedScore(star)}
                    onMouseEnter={() => setHoveredScore(star)}
                    onMouseLeave={() => setHoveredScore(null)}
                  >
                    <Star className={`w-8 h-8 transition-colors ${
                      star <= (hoveredScore || selectedScore || 0)
                        ? 'fill-yellow-400 text-yellow-400'
                        : darkMode ? 'text-gray-1002' : 'text-gray-300'
                    }`} />
                  </button>
                ))}
              </div>

              {/* Label */}
              <div className="flex justify-center mb-6 h-6">
                {activeEmoji && (
                  <p className="text-sm font-semibold text-primary">
                    {activeEmoji.label}
                  </p>
                )}
              </div>

              {/* Feedback */}
              <div className="mb-6">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add a comment (optional)..."
                  rows={3}
                  maxLength={500}
                  className={`w-full p-3 rounded-xl border outline-none resize-none text-sm ${
                    darkMode
                      ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                      : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                  }`}
                />
                <p className={`text-xs mt-1 text-right ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  {feedback.length}/500
                </p>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !selectedScore}
                className={`w-full py-4 rounded-xl font-semibold text-white bg-primary transition-all ${
                  loading || !selectedScore
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:opacity-90'
                }`}
              >
                {loading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}