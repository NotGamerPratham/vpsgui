import { Link } from 'react-router-dom';

import { Reveal } from '@/components/reveal';
import { SecurityGrid } from '@/components/security-grid';
import { Section, SectionHeading } from '@/components/section';
import { securityDuties, securityGuards } from '@/data/security';

export function SecurityPreview() {
  return (
    <Section id="security">
      <SectionHeading
        index="05"
        label="Security"
        title={
          <>
            The agent token is a <span className="accent-word">root password</span>.
          </>
        }
        lede="Not a metaphor. The agent runs shell commands, installs packages and writes files, so anyone holding that token owns the machine. There is no user database and no RBAC — network reach plus the token is the whole access model."
      />

      <Reveal className="mt-10">
        <p className="clay-inset max-w-3xl rounded-2xl border-l-4 border-foreground p-6 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          <span className="mb-2 block font-mono text-[0.6875rem] tracking-wide text-foreground uppercase">
            Read this first
          </span>
          Before you expose it: serve the console over HTTPS, keep the agent bound to loopback, and
          put a VPN, firewall allowlist or authenticating proxy in front of it. The sign-in screen
          is a local profile gate, not authentication.
        </p>
      </Reveal>

      <SecurityGrid points={securityGuards.slice(0, 3)} columns={3} className="mt-10" />
      <SecurityGrid points={securityDuties} className="mt-5" />

      <Reveal delay={0.06} className="mt-10">
        <Link
          to="/security"
          className="text-[0.9375rem] underline underline-offset-4 transition-opacity hover:opacity-65"
        >
          The full model, including what happens when each thing goes wrong
        </Link>
      </Reveal>
    </Section>
  );
}
