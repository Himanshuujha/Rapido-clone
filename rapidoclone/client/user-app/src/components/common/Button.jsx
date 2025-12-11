import React from 'react';
import clsx from 'clsx'; // optional; remove if you don't use it

const Button = ({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost'
  size = 'md',        // 'sm' | 'md' | 'lg'
  fullWidth = false,
  disabled = false,
  className = '',
  ...rest
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
  }[size];

  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary:
      'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400',
    outline:
      'border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 focus:ring-blue-500',
    ghost:
      'text-gray-800 hover:bg-gray-100 focus:ring-blue-500',
  }[variant];

  return (
    <button
      type={type}
      className={clsx(
        baseClasses,
        sizeClasses,
        variantClasses,
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;