import React, { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  fullWidth?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '', fullWidth = false }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className={`group relative flex items-center ${fullWidth ? 'w-full' : 'w-fit'} ${className}`}>
      {children}
      <div className={`absolute z-[60] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-700 shadow-xl whitespace-nowrap pointer-events-none ${positionClasses[position]}`}>
        {content}
        {/* Tiny arrow */}
        <div className={`absolute w-1.5 h-1.5 bg-slate-800 border-slate-700 transform rotate-45 
            ${position === 'top' ? 'bottom-[-3px] left-1/2 -translate-x-1/2 border-b border-r' : ''}
            ${position === 'bottom' ? 'top-[-3px] left-1/2 -translate-x-1/2 border-t border-l' : ''}
            ${position === 'left' ? 'right-[-3px] top-1/2 -translate-y-1/2 border-t border-r' : ''}
            ${position === 'right' ? 'left-[-3px] top-1/2 -translate-y-1/2 border-b border-l' : ''}
        `}></div>
      </div>
    </div>
  );
};

export default Tooltip;