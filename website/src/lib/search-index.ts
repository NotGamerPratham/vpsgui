import { endpointGroups } from '@/data/api';
import { docSections, type DocBlock } from '@/data/docs';
import { faqs } from '@/data/faq';

/**
 * A flat, client-side search index over everything the site already ships as data.
 *
 * Built at module load from the same arrays the pages render, so a section can never appear on the
 * page but be missing from search - the failure mode of every hand-maintained index. There is no
 * search service and no network call: the whole corpus is a few dozen records, which is far below
 * the point where a real index (or a dependency like Fuse) would earn its bytes.
 */

export type SearchKind = 'doc' | 'endpoint' | 'faq';

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  /** Primary line in the result list. */
  title: string;
  /** Secondary line: the group for docs, the summary for routes. */
  subtitle: string;
  /** Route + hash the result navigates to. */
  href: string;
  /** Lower-cased haystack of everything worth matching against. */
  haystack: string;
}

/** Flatten a doc block into plain prose so code and table cells are searchable too. */
function blockText(block: DocBlock): string {
  switch (block.kind) {
    case 'p':
      return block.text;
    case 'code':
      return `${block.filename ?? ''} ${block.code}`;
    case 'list':
      return block.items.join(' ');
    case 'note':
      return block.text;
    case 'table':
      return `${block.head.join(' ')} ${block.rows.map((row) => row.join(' ')).join(' ')}`;
    default:
      return '';
  }
}

function build(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const section of docSections) {
    const body = section.blocks.map(blockText).join(' ');
    docs.push({
      id: `doc:${section.id}`,
      kind: 'doc',
      title: section.title,
      subtitle: section.group,
      href: `/docs#${section.id}`,
      haystack: `${section.title} ${section.group} ${body}`.toLowerCase(),
    });
  }

  for (const group of endpointGroups) {
    for (const route of group.routes) {
      docs.push({
        id: `endpoint:${route.method}:${route.path}`,
        kind: 'endpoint',
        // The method belongs in the title: GET and POST on one path are different operations.
        title: `${route.method} ${route.path}`,
        subtitle: route.summary,
        href: '/api',
        haystack:
          `${route.method} ${route.path} ${route.summary} ${group.resource} ${group.description}`.toLowerCase(),
      });
    }
  }

  for (const faq of faqs) {
    docs.push({
      id: `faq:${faq.id}`,
      kind: 'faq',
      title: faq.question,
      subtitle: 'FAQ',
      href: `/#faq`,
      haystack: `${faq.question} ${faq.answer}`.toLowerCase(),
    });
  }

  return docs;
}

export const searchIndex: SearchDoc[] = build();

/**
 * Rank the index against a query.
 *
 * Every whitespace-separated term must appear somewhere in the record (AND, not OR) - with a corpus
 * this small, OR returns almost everything and ranking alone cannot rescue it. Position and field
 * then decide the order: a term in the title beats the same term buried in a paragraph.
 */
export function searchDocs(query: string, limit = 8): SearchDoc[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { doc: SearchDoc; score: number }[] = [];

  for (const doc of searchIndex) {
    const title = doc.title.toLowerCase();
    const subtitle = doc.subtitle.toLowerCase();

    let score = 0;
    let matchedAll = true;

    for (const term of terms) {
      if (!doc.haystack.includes(term)) {
        matchedAll = false;
        break;
      }
      if (title.startsWith(term)) score += 12;
      else if (title.includes(term)) score += 8;
      else if (subtitle.includes(term)) score += 4;
      else score += 1;
    }

    if (!matchedAll) continue;

    // An exact phrase hit in the title is what the user almost always meant.
    if (terms.length > 1 && title.includes(terms.join(' '))) score += 10;

    scored.push({ doc, score });
  }

  return scored
    // Stable tie-break on title, so equal scores do not reorder between keystrokes.
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit)
    .map((entry) => entry.doc);
}
