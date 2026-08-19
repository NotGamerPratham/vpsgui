import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { CommandLine } from '@/components/command-line';
import { GridBackdrop } from '@/components/grid-backdrop';
import { TerminalDemo } from '@/components/terminal-demo';
import { Button } from '@/components/ui/button';
import { installCommand, site } from '@/data/site';

export function Hero() {
  const reduced = useReducedMotion();

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 0.61, 0.36, 1] as const },
        };

  return (
    <section className="relative px-5 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
      <GridBackdrop />

      <div className="mx-auto w-full max-w-5xl">
        <motion.p {...rise(0)} className="eyebrow">
          MIT &middot; self-hosted &middot; Linux and Docker
        </motion.p>

        <motion.h1
          {...rise(0.05)}
          className="mt-6 max-w-3xl text-[2.5rem] leading-[1.05] sm:text-[3.5rem] lg:text-[4rem]"
        >
          Run your Linux servers from a <span className="accent-word">browser tab</span>.
        </motion.h1>

        <motion.p
          {...rise(0.1)}
          className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground text-pretty"
        >
          Install it on the box and you get live readings out of{' '}
          <code className="font-mono text-[0.9em] text-foreground">/proc</code>, a shell, the file
          tree, Docker, firewall rules and an encrypted secret store. It reads the machine directly.
          Nothing is simulated and nothing leaves the host.
        </motion.p>

        <motion.div {...rise(0.15)} className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/#install">Install it</Link>
          </Button>

          <Button asChild variant="outline" size="lg">
            <a href={site.repo} target="_blank" rel="noreferrer noopener">
              Read the source
            </a>
          </Button>

          <span className="ml-1 hidden text-sm text-subtle sm:inline">
            Takes about two minutes.
          </span>
        </motion.div>

        <motion.div {...rise(0.2)} className="mt-8 max-w-2xl">
          <CommandLine command={installCommand} />
        </motion.div>
      </div>

      <motion.div
        {...(reduced
          ? {}
          : {
              initial: { opacity: 0, y: 24 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6, delay: 0.26, ease: [0.22, 0.61, 0.36, 1] as const },
            })}
        className="mx-auto mt-16 w-full max-w-5xl sm:mt-20"
      >
        <TerminalDemo />

        <p className="mt-3 font-mono text-xs text-subtle">
          Example session against a fictional host. The full route table is on the{' '}
          <Link to="/api" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            API page
          </Link>
          .
        </p>
      </motion.div>
    </section>
  );
}
