import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="max-w-[90%] max-h-[90%] p-4" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-[80vh] rounded shadow-lg object-contain" />
        <div className="mt-2 text-center">
          <button onClick={onClose} className="px-4 py-2 bg-white rounded shadow text-gray-900">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

export function showImageLightbox(src, alt) {
  if (!src) return;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  function cleanup() {
    setTimeout(() => {
      try {
        root.unmount();
      } catch (e) {}
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 0);
  }

  root.render(<Lightbox src={src} alt={alt} onClose={cleanup} />);
}

export default Lightbox;
