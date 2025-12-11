import React, { useEffect } from 'react';
import Button from './Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlayClick = true,
  showCloseButton = true,
  maxWidth = 'max-w-md',
}) => {
  // Close on Esc key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
    >
      <div
        className={`bg-white rounded-lg shadow-lg w-full ${maxWidth} mx-4`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-base font-semibold text-gray-900">
            {title}
          </h3>
          {showCloseButton && (
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>

        <div className="px-4 py-3">{children}</div>

        {footer && (
          <div className="px-4 py-3 border-t flex justify-end space-x-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;