import { useState, useEffect } from 'react';

const QUOTES = [
  "The only way to do great work is to love what you do.",
  "Simplicity is the ultimate sophistication.",
  "Design is not just what it looks like and feels like. Design is how it works.",
  "Stay hungry, stay foolish."
];

export default function Quote({ widget }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex(i => (i + 1) % QUOTES.length);
    }, 10000); // Rotate every 10 seconds for demo
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-quote">
      <span>Daily Inspiration</span>
      <p>"{QUOTES[index]}"</p>
    </div>
  );
}
