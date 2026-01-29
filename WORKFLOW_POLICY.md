# Ameri-CAD Workflow Policy

**These policies are STRICTLY ENFORCED. No exceptions.**

## Pre-Commit Requirements

Every commit MUST pass:
1. **ESLint** - Zero warnings, zero errors
2. **Prettier** - All files formatted
3. **Tests** - All tests passing (CI enforced)

```bash
# These must ALL succeed before committing
npm run lint -- --max-warnings 0  # Zero tolerance
npm run format:check              # Formatting verified
npm test                          # All tests pass
```

## Commit Policy

### Never Commit Directly to Master
```bash
# WRONG
git commit -m "my changes"
git push origin master

# RIGHT  
git checkout -b feature/my-feature
git commit -m "feat: my changes"
git push origin feature/my-feature
# Create PR, pass CI, then merge
```

### Commit Message Format (Required)
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

Bad: `"fixed stuff"`, `"updates"`, `"wip"`
Good: `"fix(kernel): prevent crash on empty boolean"`

## Agent Task Requirements

All sub-agents MUST:

1. **Write tests FIRST** (TDD)
2. **Pass lint with zero warnings**
3. **Format code with Prettier**
4. **Commit with proper message**
5. **Report in standard format**

### Required Output Format
```markdown
## Task Complete ✅

### Files Changed
- `path/file.js` (created/modified) - X lines

### Tests
- Added N tests in `tests/x.test.js`

### Verification
- [ ] `npm run lint -- --max-warnings 0` - PASS
- [ ] `npm test` - X/X passing
- [ ] `npm run format:check` - PASS

### Commit
`abc1234` - type(scope): description
```

## CI Pipeline

```
Push → Lint (strict) → Format Check → Tests → Build
         ↓                ↓             ↓
      FAIL if           FAIL if      FAIL if
      warnings          unformatted  any fail
```

**CI failures block merge. No manual overrides.**

## Code Quality Standards

### No Unused Code
- Remove unused variables
- Remove unused imports
- Remove dead code paths
- Prefix intentionally unused params with `_`

### No Console Debugging
- Remove `console.log` debugging before commit
- Use proper logging system for production logs

### Type Safety
- Use strict equality (`===`)
- Check for null/undefined
- Validate function inputs

### Error Handling
- Never swallow errors silently
- Log errors with context
- Fail fast on invalid state

## Review Checklist

Before approving any code:

- [ ] Tests exist and pass
- [ ] Lint is clean (0 warnings)
- [ ] Code is formatted
- [ ] Commit messages are proper
- [ ] No debug code left in
- [ ] Error handling is appropriate
- [ ] Edge cases are covered

## Enforcement

These policies are enforced by:
1. **Pre-commit hooks** (Husky + lint-staged)
2. **CI pipeline** (GitHub Actions)
3. **Code review** (PR required)

**Bypassing these checks is a workflow violation.**

---

*"Quality is not negotiable."*
