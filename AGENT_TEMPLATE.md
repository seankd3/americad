# Agent Task Template

Use this template when spawning sub-agents for Ameri-CAD development.

---

## Task: [TASK NAME]

Location: ~/Projects/americad

### Goal
[Clear description of what needs to be done]

### Requirements
[Specific requirements and acceptance criteria]

### Implementation Notes
[Any technical guidance or patterns to follow]

---

## MANDATORY CHECKLIST

Before marking this task complete, you MUST:

- [ ] **Tests First**: Write tests before or alongside implementation (TDD)
- [ ] **Tests Pass**: Run `npm test` (or `npm run test:count` for quick check)
- [ ] **Lint Clean**: Run `npm run lint` - fix all errors
- [ ] **Formatted**: Run `npm run format`
- [ ] **Committed**: Use conventional commit format: `type(scope): description`
- [ ] **Summary**: Provide output in the format below

**Failure to complete this checklist means the task is NOT done.**

⚠️ **STRICT ENFORCEMENT**: Pre-commit hooks WILL reject commits that fail lint.
Run `npm run lint -- --max-warnings 0` before committing!

---

## Required Output Format

When complete, provide this EXACT format:

```
## Task Complete ✅

### Files Changed
- `path/to/file.js` (created/modified) - X lines
- `path/to/test.js` (created) - Y lines

### Tests
- Added N tests in `tests/feature.test.js`
- Test names:
  - "should do expected thing"
  - "should handle edge case"
  - "should reject invalid input"

### Verification
- [ ] `npm run lint` - PASS (0 errors)
- [ ] `npm run test:count` - PASS (N tests)
- [ ] Manual verification: [what you checked]

### Commit
`abc1234` - type(scope): description

### Notes
[Any issues, decisions, or follow-up items]
```

---

## Code Standards

### Style
- Use `const` by default, `let` when needed, never `var`
- Use strict equality (`===`)
- Always use curly braces for if/for/while
- Follow existing patterns in the codebase

### Testing
- Test file: `tests/[feature].test.js`
- Use describe/it blocks
- Test happy path, edge cases, and error handling
- Mock external dependencies

### Commits
```
feat(sketch): add spline tool
fix(kernel): prevent crash on empty boolean
test(extrude): add edge case tests
docs(api): document bridge methods
refactor(ui): simplify property panel
```

---

## Example Task

```markdown
## Task: Add Circle Fillet Command

Location: ~/Projects/americad

### Goal
Add a command to fillet all edges of a selected cylinder at once.

### Requirements
- Command: `fillet-circle <radius>`
- Select cylinder, run command
- All circular edges get filleted
- Works with any cylinder orientation

### Implementation Notes
- Use kernel.fillet() for each edge
- Get edges via kernel.getEdges()
- Filter for circular edges (check edge type)
```
