#!/usr/bin/env node
// Parse coverage output and generate badge data
import { execSync } from 'child_process';

try {
  const output = execSync('c8 report --reporter=text-summary 2>&1', { encoding: 'utf8' });
  const match = output.match(/All files[^|]+\|\s+([\d.]+)/);
  const coverage = match ? parseFloat(match[1]) : 0;

  const color = coverage > 80 ? 'green' : coverage > 60 ? 'yellow' : 'red';
  console.log(`Coverage: ${coverage.toFixed(1)}% (${color})`);

  // Update README badge if desired
} catch (error) {
  console.error('Error getting coverage:', error.message);
  process.exit(1);
}
