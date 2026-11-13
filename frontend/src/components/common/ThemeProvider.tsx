import React, { useEffect } from 'react';
import { startThemeSync } from '../../lib/theme';

/** Applies the saved theme and follows the system preference while the app is mounted. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => startThemeSync(), []);
  return <>{children}</>;
};
