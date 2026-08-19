import type { LucideIcon } from 'lucide-react';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface CodeSample {
  id: string;
  label: string;
  /** Package manager one-liner shown in the copy button. */
  install: string;
  language: string;
  registryUrl: string;
  code: string;
}

export interface NavLink {
  label: string;
  href: string;
  /** True for in-page anchors, false for router routes and external URLs. */
  external?: boolean;
}

export interface EndpointGroup {
  resource: string;
  description: string;
  routes: Array<{ method: 'GET' | 'POST' | 'DELETE'; path: string; summary: string }>;
}

export interface QuickstartStep {
  n: number;
  title: string;
  body: string;
  command?: string;
  note?: string;
}

export interface SecurityPoint {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** 'guard' = something VPSGUI does for you. 'duty' = something you must do. */
  kind: 'guard' | 'duty';
}
