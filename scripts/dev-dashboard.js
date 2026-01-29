#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    return e.stdout || '';
  }
}

console.log('\n📊 AMERI-CAD DEVELOPMENT DASHBOARD\n');
console.log('═'.repeat(50));

// Git stats
const commits = run('git log --oneline --since="midnight" | wc -l');
console.log(`\n📝 Commits today: ${commits}`);

// Lines of code
const loc = run('find src -name "*.js" | xargs wc -l | tail -1');
console.log(`📏 Source lines: ${loc}`);

// Test status
console.log('\n🧪 Running tests...');
const testResult = run('npm test 2>&1 | tail -5');
console.log(testResult);

// Lint status
console.log('\n🔍 Lint check...');
const lintResult = run('npm run lint 2>&1 | tail -3');
console.log(lintResult || '✅ No warnings');

// TODOs
console.log('\n📋 TODOs in codebase:');
const todos = run('grep -rn "TODO\\|FIXME\\|HACK" src/ --include="*.js" | head -10');
console.log(todos || 'None found');

console.log('\n' + '═'.repeat(50));
