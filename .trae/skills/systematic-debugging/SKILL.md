---
name: "systematic-debugging"
description: "Systematic debugging methodology with runtime evidence collection. Invoke when encountering bugs, test failures, or unexpected behavior. Replaces TRAE-debugger."
---

# Systematic Debugging

This skill provides a comprehensive debugging approach combining methodology and runtime evidence collection.

## When to Use

Invoke this skill when:
- Encountering any bug, test failure, or unexpected behavior
- Before proposing fixes
- Need to collect runtime evidence
- Static analysis is insufficient
- User requests debugging assistance

## Debugging Process

Follow this systematic approach:

### 1. Understand the Problem

- Reproduce the issue consistently
- Gather error messages, logs, and symptoms
- Identify what changed recently
- Define expected vs actual behavior

### 2. Form Hypotheses

- List possible causes based on symptoms
- Prioritize by likelihood and impact
- Consider recent changes first
- Don't jump to conclusions

### 3. Collect Evidence

**Static Analysis:**
- Read relevant code
- Check logs and error messages
- Review recent changes
- Analyze stack traces

**Runtime Evidence (when needed):**
- Start debug server to collect logs via HTTP
- Add instrumentation to capture runtime state
- Reproduce the issue with logging enabled
- Collect timing, state, and execution flow data

### 4. Test Hypotheses

- Design experiments to validate/invalidate each hypothesis
- Start with the most likely cause
- Change one variable at a time
- Document results systematically

### 5. Identify Root Cause

- Correlate evidence with hypotheses
- Verify the root cause explains all symptoms
- Ensure you understand WHY it happens, not just WHAT

### 6. Implement Fix

- Address the root cause, not symptoms
- Keep changes minimal and focused
- Consider edge cases and side effects
- Ensure fix doesn't break other functionality

### 7. Verify Fix

- Confirm the original issue is resolved
- Test related functionality
- Run full test suite if applicable
- Verify no regressions introduced

### 8. Document Learnings

- Update relevant documentation
- Add tests to prevent regression
- Share insights with team if applicable

## Best Practices

- **Don't guess**: Base decisions on evidence, not assumptions
- **One change at a time**: Isolate variables to understand impact
- **Reproduce first**: Ensure you can consistently reproduce before fixing
- **Think systematically**: Follow the process, don't skip steps
- **Document everything**: Keep notes on what you tried and learned
- **Know when to escalate**: If stuck after reasonable effort, seek help

## Common Pitfalls

- Jumping to fixes without understanding the problem
- Making multiple changes at once
- Ignoring evidence that contradicts your hypothesis
- Fixing symptoms instead of root causes
- Not verifying the fix works completely
- Forgetting to document the solution

## Tools and Techniques

- **Logs**: Add strategic logging to understand execution flow
- **Breakpoints**: Use debugger to inspect state at specific points
- **Unit tests**: Write tests to isolate and reproduce issues
- **Git bisect**: Find when a bug was introduced
- **Minimal reproduction**: Create smallest possible test case
