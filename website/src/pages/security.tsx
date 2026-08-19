import { CodeBlock } from '@/components/code-block';
import { GridBackdrop } from '@/components/grid-backdrop';
import { Reveal } from '@/components/reveal';
import { SecurityGrid } from '@/components/security-grid';
import { securityDuties, securityGuards } from '@/data/security';
import { site } from '@/data/site';
import { usePageMeta } from '@/hooks/use-page-meta';

const HARDENING = `# 1. Never publish the agent port. It listens on loopback by default.
sudo ss -lntp | grep 46509        # expect 127.0.0.1:46509, not 0.0.0.0

# 2. Terminate TLS before signing in from anywhere but the box itself.
sudo certbot --nginx -d vps.example.com

# 3. Restrict who can even reach the console.
sudo ufw allow from 10.8.0.0/24 to any port 443 proto tcp
sudo ufw deny 443/tcp

# 4. Rotate the token by editing agent.env and restarting the agent.
sudo nano /opt/vpsgui/agent/agent.env
sudo pm2 restart vpsgui-agent`;

const THREATS: Array<{ scenario: string; outcome: string; mitigation: string }> = [
  {
    scenario: 'Someone guesses or brute-forces the agent token',
    outcome: 'Full control of the host.',
    mitigation:
      'Tokens are generated with a CSPRNG and compared in constant time, and repeated failures lock the client out. Keep the length the installer chose.',
  },
  {
    scenario: 'The token is sniffed in transit',
    outcome: 'Full control of the host.',
    mitigation:
      'It is a bearer header, so TLS is the only thing protecting it. VPSGUI cannot encrypt a connection you terminated as plain HTTP.',
  },
  {
    scenario: 'Someone reaches the console without a token',
    outcome: 'They see the sign-in gate; every privileged call answers 401.',
    mitigation:
      'The gate is not authentication. Treat network reachability as the real control and put a VPN or authenticating proxy in front.',
  },
  {
    scenario: 'A symlink is planted inside an allowed file root',
    outcome: 'Attempted read or write outside the root.',
    mitigation:
      'Paths are resolved with realpath and re-checked against the roots after resolution, so the traversal is refused.',
  },
  {
    scenario: 'A file root is set to / and someone requests /etc/shadow',
    outcome: 'Attempted credential disclosure.',
    mitigation:
      'Shadow files, private keys, the token file and the encrypted secret store are on a deny-list the reader enforces regardless of configured roots.',
  },
];

export default function SecurityPage() {
  usePageMeta('/security');

  return (
    <>
      <section className="relative px-5 pt-16 pb-12 sm:px-8 sm:pt-20">
        <GridBackdrop />

        <div className="mx-auto w-full max-w-5xl">
          <p className="eyebrow">Security model</p>

          <h1 className="mt-5 max-w-2xl text-[2.25rem] sm:text-[3rem]">
            What it protects, and what it <span className="accent-word">cannot</span>.
          </h1>

          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
            VPSGUI runs shell commands, installs packages, drives systemd and Docker, and reads and
            writes files. No version of that is low-risk. This page is written for someone deciding
            whether to expose it, not to reassure them.
          </p>

          <a
            href={site.docs.security}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-7 inline-block font-mono text-[0.8125rem] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            docs/SECURITY.md
          </a>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-16">
          <Reveal>
            <div className="clay-inset max-w-3xl rounded-2xl border-l-4 border-foreground p-7">
              <p className="mb-3 inline-block rounded-md bg-foreground px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-background uppercase">
                Warning
              </p>
              <h2 className="text-[1.0625rem]">The agent token is equivalent to a root password</h2>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                Anyone who can reach the agent while holding that token owns the machine. Store it
                the way you would store a root password: out of version control, out of image
                layers, out of any frontend bundle, and only ever sent over TLS.
              </p>
            </div>
          </Reveal>

          <div>
            <h2 className="text-[1.5rem]">Enforced by the agent</h2>
            <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
              These hold without any configuration on your part.
            </p>
            <SecurityGrid points={securityGuards} columns={3} className="mt-8" />
          </div>

          <div>
            <h2 className="text-[1.5rem]">Left to you</h2>
            <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
              No amount of application code covers these. If they are not done, the list above does
              not save you.
            </p>
            <SecurityGrid points={securityDuties} className="mt-8" />
          </div>

          <div>
            <h2 className="text-[1.5rem]">If this happens, then what</h2>
            <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
              Worth thinking through before you open port 443.
            </p>

            <Reveal className="mt-8">
              <div className="clay overflow-x-auto rounded-2xl p-2">
                <table className="w-full min-w-3xl border-collapse text-left text-[0.875rem]">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="eyebrow px-5 py-4 text-left">
                        Scenario
                      </th>
                      <th scope="col" className="eyebrow px-5 py-4 text-left">
                        Impact
                      </th>
                      <th scope="col" className="eyebrow px-5 py-4 text-left">
                        What stands in the way
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {THREATS.map((row) => (
                      <tr key={row.scenario} className="align-top">
                        <th scope="row" className="px-5 py-4 text-left font-medium text-pretty">
                          {row.scenario}
                        </th>
                        <td className="px-5 py-4 text-muted-foreground text-pretty">
                          {row.outcome}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-pretty">{row.mitigation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>

          <div>
            <h2 className="text-[1.5rem]">Hardening checklist</h2>
            <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
              Run through this before the console is reachable from anywhere but localhost.
            </p>

            <Reveal className="mt-8">
              <CodeBlock code={HARDENING} language="bash" filename="hardening" />
            </Reveal>
          </div>

          <Reveal>
            <div className="clay max-w-3xl rounded-2xl p-7">
              <h2 className="text-[1.0625rem]">Reporting a vulnerability</h2>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                Please do not open a public issue for a security bug in the agent. Contact the
                maintainer through{' '}
                <a
                  href={site.author.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground underline underline-offset-4 transition-opacity hover:opacity-65"
                >
                  notgamerpratham.com
                </a>{' '}
                first, and give the fix a chance to ship before disclosure.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
