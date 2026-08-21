import { describe, it, expect } from 'vitest';

// @ts-expect-error - plain .mjs helper, no type declarations by design.
import { renderTable, spliceBlock, START, END } from '../scripts/update-contributors.mjs';

/**
 * The contributor block in README.md is machine-written, so the failure mode is
 * a workflow that commits a mangled README on a schedule with nobody watching.
 * These cover the pure parts - rendering and splicing - without touching the
 * network, which is the half that can silently corrupt the file.
 */

interface Contributor {
  login: string;
  html_url: string;
  avatar_url: string;
  contributions: number;
  type?: string;
}

function person(login: string, contributions: number, type = 'User'): Contributor {
  return {
    login,
    html_url: `https://github.com/${login}`,
    avatar_url: `https://avatars.githubusercontent.com/u/1?v=4`,
    contributions,
    type,
  };
}

function readme(body: string): string {
  return `# Project\n\nintro\n\n${START}\n\n${body}\n\n${END}\n\n## Licence\n\nMIT\n`;
}

describe('renderTable', () => {
  it('renders one cell per contributor, linked to their profile', () => {
    const html = renderTable([person('alice', 12), person('bob', 3)]);

    expect(html).toContain('https://github.com/alice');
    expect(html).toContain('https://github.com/bob');
    expect(html).toContain('<b>alice</b>');
    expect((html.match(/<td align="center">/g) || []).length).toBe(2);
  });

  it('pluralises the commit count rather than printing "1 commits"', () => {
    const html = renderTable([person('solo', 1)]);
    expect(html).toContain('1 commit<');
    expect(html).not.toContain('1 commits');
  });

  it('wraps onto a new row so a long list stays readable on a phone', () => {
    // Seven people at six per row must produce exactly two <tr> blocks.
    const many = Array.from({ length: 7 }, (_, i) => person(`dev${i}`, 10 - i));
    const html = renderTable(many);
    expect((html.match(/<tr>/g) || []).length).toBe(2);
  });

  it('reports an honest total rather than a rounded-looking number', () => {
    const html = renderTable([person('a', 10), person('b', 5)]);
    expect(html).toContain('<b>2</b> contributors');
    expect(html).toContain('<b>15</b> commits');
  });

  it('says so plainly when the API reports nobody', () => {
    // Better than emitting an empty <table>, which renders as a stray border.
    const html = renderTable([]);
    expect(html).not.toContain('<table>');
    expect(html).toMatch(/no contributors/i);
  });

  it('requests a retina-sized avatar so the image is not blurry', () => {
    const html = renderTable([person('alice', 1)]);
    expect(html).toContain('&s=160');
    expect(html).toContain('width="80"');
  });
});

describe('spliceBlock', () => {
  it('replaces only the marked region and leaves surrounding prose intact', () => {
    const before = readme('_placeholder_');
    const after = spliceBlock(before, '<table>NEW</table>');

    expect(after).toContain('<table>NEW</table>');
    expect(after).not.toContain('_placeholder_');
    // Everything outside the markers must survive verbatim.
    expect(after).toContain('# Project');
    expect(after).toContain('intro');
    expect(after).toContain('## Licence');
    expect(after).toContain('MIT');
  });

  it('keeps both markers so the next run can find the region again', () => {
    const after = spliceBlock(readme('old'), 'new');
    expect(after).toContain(START);
    expect(after).toContain(END);
    expect((after.match(/CONTRIBUTORS:START/g) || []).length).toBe(1);
    expect((after.match(/CONTRIBUTORS:END/g) || []).length).toBe(1);
  });

  it('is idempotent, so an unchanged contributor list produces no commit', () => {
    // The workflow commits only on a diff; splicing the same content twice must
    // be byte-identical or it would commit noise every single day.
    const once = spliceBlock(readme('old'), '<table>SAME</table>');
    const twice = spliceBlock(once, '<table>SAME</table>');
    expect(twice).toBe(once);
  });

  it('refuses to write when the markers are missing instead of guessing', () => {
    // Appending to an unmarked README would quietly duplicate the section on
    // every run until the file was unusable.
    expect(() => spliceBlock('# Project\n\nno markers here\n', 'x')).toThrow(/marker/i);
  });

  it('refuses when the markers are inverted', () => {
    const broken = `# P\n${END}\nbody\n${START}\n`;
    expect(() => spliceBlock(broken, 'x')).toThrow(/marker/i);
  });
});
