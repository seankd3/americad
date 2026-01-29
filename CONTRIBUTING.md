# Contributing to Ameri-CAD

## Development Workflow

### Branch Strategy

**Never commit directly to `master`.**

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Work, commit frequently
git add -A
git commit -m "feat: description of change"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes nor adds
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(sketch): add spline tool with Catmull-Rom interpolation
fix(kernel): prevent crash on empty boolean operation
test(extrude): add edge case tests for zero-height extrusion
docs(api): document kernel bridge methods
```

### Before Committing

1. **Run linter:**
   ```bash
   npm run lint
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Format code:**
   ```bash
   npm run format
   ```

Pre-commit hooks will enforce this automatically.

### Code Style

- **ESLint** enforces code quality
- **Prettier** enforces formatting
- Use `const` by default, `let` when needed, never `var`
- Use strict equality (`===`)
- Always use curly braces for control structures

### Testing Requirements

**Every feature must have tests.**

```javascript
describe('Feature Name', () => {
  it('should do the expected thing', () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = featureUnderTest(input);
    
    // Assert
    expect(result).to.equal(expectedOutput);
  });

  it('should handle edge case', () => {
    // ...
  });

  it('should reject invalid input', () => {
    // ...
  });
});
```

**Test file naming:** `[feature].test.js`

### Agent Development Guidelines

When spawning sub-agents for development:

```markdown
## MANDATORY CHECKLIST
Before marking complete:
- [ ] Tests written (TDD preferred)
- [ ] All tests pass: `npm test`
- [ ] Linter passes: `npm run lint`
- [ ] Code formatted: `npm run format`
- [ ] Committed with conventional message
- [ ] Summary includes: files changed, tests added, commit hash

## Output Format
When complete, provide:
1. Files created/modified (list with line counts)
2. Tests written (count and names)
3. Test results (pass/fail)
4. Commit hash
5. Any issues or notes
```

### Pull Request Checklist

- [ ] Branch is up to date with master
- [ ] All tests pass
- [ ] Linter passes
- [ ] New features have tests
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] No console.log debugging left in

### Code Review Focus Areas

1. **Correctness** - Does it work as intended?
2. **Tests** - Are edge cases covered?
3. **Performance** - Any obvious bottlenecks?
4. **Readability** - Is it clear what the code does?
5. **Consistency** - Does it match existing patterns?

## Architecture Decisions

Major architecture decisions are documented in `ARCHITECTURE_DECISIONS.md`.

Before making significant changes:
1. Check existing ADRs
2. Discuss in issue/PR
3. Consider Council deliberation for complex decisions

## Getting Help

- Read `ARCHITECTURE_DECISIONS.md` for design rationale
- Check `VISION.md` for project direction
- Review existing code for patterns
- Ask questions in PR comments
