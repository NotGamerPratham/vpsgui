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

      <Reveal className="mt-10 max-w-3xl">
        <p className="border-l-2 border-warning/60 py-1 pl-5 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          Before you expose it: serve the console over HTTPS, keep the agent bound to loopback, and
          put a VPN, firewall allowlist or authenticating proxy in front of it. The sign-in screen is
          a local profile gate, not authentication.
        </p>
      </Reveal>

      <SecurityGrid points={securityGuards.slice(0, 4)} className="mt-10" />
      <SecurityGrid points={securityDuties} className="mt-0" />

      <Reveal delay={0.06} className="mt-10">
        <Link
          to="/security"
          className="text-[0.9375rem] text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          The full model, including what happens when each thing goes wrong
        </Link>
      </Reveal>
    </Section>
  );
}
