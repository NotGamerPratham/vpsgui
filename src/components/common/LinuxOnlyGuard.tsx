import React from 'react';

export function LinuxOnlyGuard({ children }: { children: React.ReactNode }) {
  // Allow all web clients to access the Linux VPS Web Desktop GUI seamlessly
  return <>{children}</>;
}
