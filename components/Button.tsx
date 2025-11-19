import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  icon,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:pointer-events-none rounded-lg";
  
  const variants = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800 focus:ring-neutral-900 shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
    secondary: "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 focus:ring-neutral-200 shadow-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:focus:ring-neutral-700",
    ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};