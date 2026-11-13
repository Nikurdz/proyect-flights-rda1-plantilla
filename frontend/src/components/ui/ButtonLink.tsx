import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { ButtonProps } from './Button';
import { buttonClassName } from './button-styles';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

/** A router link that looks like a Button: one interactive element, never a `<a><button/></a>`. */
export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(({ variant = 'primary', size = 'md', className, ...props }, ref) => (
  <Link ref={ref} className={buttonClassName(variant, size, className)} {...props} />
));

ButtonLink.displayName = 'ButtonLink';
