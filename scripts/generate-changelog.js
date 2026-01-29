#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const commits = execSync('git log --format="%H|%s|%ad" --date=short', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map(line => {
    const [hash, subject, date] = line.split('|');
    const match = subject.match(/^(feat|fix|docs|style|refactor|test|chore)(\(.*\))?:\s*(.+)$/);
    return {
      hash: hash.slice(0, 7),
      type: match?.[1] || 'other',
      scope: match?.[2]?.slice(1, -1) || '',
      message: match?.[3] || subject,
      date
    };
  });

const groups = {
  feat: { title: 'Features', items: [] },
  fix: { title: 'Bug Fixes', items: [] },
  docs: { title: 'Documentation', items: [] },
  refactor: { title: 'Refactoring', items: [] },
  test: { title: 'Tests', items: [] },
  chore: { title: 'Chores', items: [] },
  other: { title: 'Other', items: [] }
};

commits.forEach(c => {
  const group = groups[c.type] || groups.other;
  group.items.push(`- ${c.message} (${c.hash})`);
});

let changelog = '# Changelog\n\n## [Unreleased]\n\n';
for (const [type, group] of Object.entries(groups)) {
  if (group.items.length > 0) {
    changelog += `### ${group.title}\n${group.items.join('\n')}\n\n`;
  }
}

writeFileSync('CHANGELOG.md', changelog);
console.log('✅ CHANGELOG.md generated');
