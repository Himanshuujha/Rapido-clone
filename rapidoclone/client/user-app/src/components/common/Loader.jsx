import React from 'react';

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

const Loader = ({ size = 'md', className = '' }) => {
  const px = typeof size === 'number' ? size : sizeMap[size] || sizeMap.md;

  const style = {
    width: px,
    height: px,
    borderWidth: px / 8,
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div
        className="loader-spinner border-gray-300 border-t-blue-600 rounded-full animate-spin"
        style={style}
      />
    </div>
  );
};

export default Loader;