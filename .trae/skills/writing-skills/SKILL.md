---
name: "writing-skills"
description: "Create, edit, and validate SKILLs. Invoke when user wants to create, add, edit, or validate any skill. Replaces skill-creator."
---

# Writing Skills

This skill handles the full lifecycle of SKILL management: creation, editing, and validation.

## When to Use

Invoke this skill when:
- User wants to create a new skill
- User wants to add a custom skill to the workspace
- User wants to edit an existing skill
- User wants to validate a skill before deployment
- User asks "how to create/edit a skill"
- User mentions creating, adding, editing, or making any skill

## SKILL Structure

A valid SKILL requires:

1. **Directory**: `.trae/skills/<skill-name>/`
2. **File**: `SKILL.md` inside the directory

## SKILL.md Format

```markdown
---
name: "<skill-name>"
description: "<concise description covering: (1) what the skill does, (2) when to invoke it. Keep it under 200 characters for best display>"
---

# <Skill Title>

<Detailed instructions, usage guidelines, and examples>
```

## Required Fields

| Field | Location | Description |
|-------|----------|-------------|
| `name` | frontmatter | Unique identifier for the skill |
| `description` | frontmatter | **CRITICAL**: Must include (1) what the skill does AND (2) when to invoke it. Keep under 200 chars. |
| `detail` | body | Full markdown content after frontmatter |

## Creation Steps

1. Ask user for skill name and purpose
2. Generate the `description` field with:
   - What the skill does (functionality)
   - When to invoke it (trigger conditions/scenarios)
   - Example: "Does X. Invoke when Y happens or user asks for Z."
3. Create directory: `.trae/skills/<skill-name>/`
4. Create `SKILL.md` with proper frontmatter and content
5. Validate the structure is correct

## Editing Steps

1. Read the existing `SKILL.md`
2. Identify what needs to change
3. Update the file while preserving valid frontmatter
4. Validate the updated structure

## Validation Checklist

- [ ] Directory exists at `.trae/skills/<skill-name>/`
- [ ] `SKILL.md` file exists in the directory
- [ ] Frontmatter has valid `name` and `description` fields
- [ ] Description includes both what it does AND when to invoke
- [ ] Description is under 200 characters
- [ ] Body content is well-structured markdown

## Example

To create a "code-reviewer" skill:

```bash
mkdir -p .trae/skills/code-reviewer
```

Then create `.trae/skills/code-reviewer/SKILL.md`:

```markdown
---
name: "code-reviewer"
description: "Reviews code for best practices, bugs, and improvements. Invoke when user asks for code review or before merging changes."
---

# Code Reviewer

This skill reviews code and provides feedback...
```
