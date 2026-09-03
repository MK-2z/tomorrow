import React from 'react';

/**
 * UniversalLink 替代组件
 * 简单的链接组件
 */
export const UniversalLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
}> = ({ href, children, className, target }) => {
  return (
    <a href={href} className={className} target={target || '_blank'} rel="noopener noreferrer">
      {children}
    </a>
  );
};
