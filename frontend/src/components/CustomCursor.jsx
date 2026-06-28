import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [clicked, setClicked] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);

  useEffect(() => {
    const addEventListeners = () => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mouseup', onMouseUp);
    };

    const removeEventListeners = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const onMouseDown = () => setClicked(true);
    const onMouseUp = () => setClicked(false);

    const handleLinkHoverEvents = () => {
      document.querySelectorAll('a, button, input, textarea, select, [role="button"]').forEach((el) => {
        el.addEventListener('mouseenter', () => setLinkHovered(true));
        el.addEventListener('mouseleave', () => setLinkHovered(false));
      });
    };

    addEventListeners();
    
    // Slight delay to allow DOM to render links/buttons
    setTimeout(handleLinkHoverEvents, 500);

    // Mutation observer to handle dynamically added elements
    const observer = new MutationObserver(() => {
      handleLinkHoverEvents();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      removeEventListeners();
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div
        className="fixed top-0 left-0 w-4 h-4 bg-gray-900 rounded-full pointer-events-none z-[9999] mix-blend-difference transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${position.x - 8}px, ${position.y - 8}px) scale(${clicked ? 0.8 : linkHovered ? 1.5 : 1})`,
        }}
      />
      <div
        className="fixed top-0 left-0 w-10 h-10 border border-gray-900 rounded-full pointer-events-none z-[9998] transition-all duration-300 ease-out hidden md:block opacity-50"
        style={{
          transform: `translate(${position.x - 20}px, ${position.y - 20}px) scale(${clicked ? 0.5 : linkHovered ? 1.2 : 1})`,
        }}
      />
    </>
  );
}
