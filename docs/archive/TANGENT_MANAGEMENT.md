# Tangent Management Guide

**Quick Reference for Managing Development Tangents**

---

## 🎯 The Problem

Software development naturally involves tangents:
- Bug discovered while implementing feature
- Missing infrastructure needed for current work
- Data issue found during testing
- Better approach discovered mid-implementation

**Tangents aren't bad** - they're necessary. The problem is **losing track of the main path**.

---

## ✅ The Solution: 3-Step Protocol

### 1. RECOGNIZE the Tangent

**Signs you're on a tangent**:
- Working on something not in original task description
- "While I'm here, let me also..."
- Building infrastructure for future work
- Fixing something you just noticed
- "This would be better if..."

### 2. DOCUMENT the Tangent

**Update DEVELOPMENT_ROADMAP.md immediately**:

```markdown
### Active Tangents

| ID | Tangent | Parent Stream | Status | Priority | Blocker |
|----|---------|---------------|--------|----------|---------|
| T-XXX | What you're doing | What you were doing | In Progress | P0/P1/P2 | If any |
```

**Include**:
- Clear description (one sentence)
- Parent work stream (what were you working on?)
- Return path (what to do when tangent is done)
- Estimated time

### 3. RETURN to Main Path

**When tangent is complete**:
1. Move tangent to "Completed Tangents" table
2. Update parent stream status
3. Check parent stream completion criteria
4. Resume parent work OR move to next backlog item

---

## 🚨 Emergency Brake: Too Many Tangents

**If you have 3+ active tangents, STOP**:

1. List all active tangents
2. Identify blockers for each
3. Choose ONE to close:
   - Quick wins (< 1 hour) → Finish it
   - Blocked items → Document blocker, pause it
   - Low priority → Move to backlog, pause it
4. Return to main path

**Rule**: Maximum 3 active tangents at any time

---

## 📋 Common Tangent Patterns

### Pattern 1: "Missing Infrastructure"

**Example**: "To test feature X, I need test data generator"

**Handle**:
```markdown
Active Tangent:
- T-001: Build test data generator
- Parent: Feature X testing
- Return: Use generator to test Feature X
- Completion: Generator working + docs
```

**Return Path**: Use the new infrastructure to complete parent task

---

### Pattern 2: "Bug Discovery"

**Example**: "While testing, found community counter bug"

**Handle**:
```markdown
Active Tangent:
- T-002: Fix community counter sync
- Parent: UI testing
- Return: Continue UI testing with correct data
- Completion: Counter displays correctly
```

**Return Path**: Verify original work still works after bug fix

---

### Pattern 3: "Scope Creep"

**Example**: "Building feature X, realized we also need Y and Z"

**Handle**:
```markdown
Active Tangent:
- T-003: Build feature X only
- Parent: Original goal
- Return: Mark Y and Z as future work

Backlog (for later):
- Feature Y
- Feature Z
```

**Return Path**: Complete ONLY the minimal viable version, add rest to backlog

---

### Pattern 4: "Better Approach Discovered"

**Example**: "Halfway through implementation, found better way"

**Handle**:
```markdown
Decision Log:
- Original approach: [description]
- New approach: [description]
- Reason for switch: [why it's better]
- Impact: [what needs to change]

Active Tangent:
- T-004: Refactor to new approach
- Parent: Original implementation
- Return: Complete with new approach
```

**Return Path**: Finish with new approach, document decision

---

## 🔄 Integration with Existing Workflow

### From DEVELOPMENT_PROCESS.md

1. **Pre-Change Checklist** → Check ROADMAP for current focus
2. **During Work** → Recognize tangents, document them
3. **Testing** → Verify both tangent AND parent work
4. **Commit** → Include tangent context in commit message

### From DEVELOPMENT_ROADMAP.md

- **Current Focus** → Main path you should be on
- **Active Tangents** → All diversions in progress
- **Backlog** → Future work discovered during tangents
- **Return Path** → What to do when tangent completes

---

## 📝 Example Session

### Bad (No Tracking)

```
User: "Test the UI"
AI: *Sets up tests*
AI: *Notices missing data display*
AI: *Builds renderer component*
AI: *Adds tests for renderer*
AI: *Writes documentation*
AI: "Testing is done!"

Result: Renderer exists but not integrated. Original problem not solved.
```

### Good (With Tracking)

```
User: "Test the UI"
AI: *Checks ROADMAP - Current Focus: UI Testing*
AI: *Sets up tests*
AI: *Notices missing data display*

AI: "⚠️ TANGENT DETECTED: Polymorphic data not rendering"
AI: *Updates ROADMAP*
   Active Tangent: T-001 Build polymorphic renderer
   Parent: UI Testing
   Return: Integrate renderer into FeedItem

AI: *Builds renderer component*
AI: *Adds tests for renderer*
AI: "Tangent T-001 complete. Returning to main path: Integrate into FeedItem"
AI: *Integrates renderer*
AI: *Verifies UI displays data*
AI: *Updates ROADMAP*
   Completed Tangent: T-001 ✅
   Status: UI Testing - polymorphic display working
```

---

## 🎯 Success Metrics

**You're managing tangents well if**:
- ✅ All active work is documented in ROADMAP
- ✅ Each tangent has clear return path
- ✅ No more than 3 active tangents
- ✅ Tangents complete before starting new ones
- ✅ Original goals still get completed

**Warning signs**:
- ❌ Many incomplete tangents
- ❌ Forgot what you were originally working on
- ❌ "Almost done" but nothing fully complete
- ❌ Building features not in backlog
- ❌ Can't explain how current work relates to goals

---

## 💡 Tips

1. **Set Time Limits**: "I'll spend max 2 hours on this tangent"
2. **Question Necessity**: "Do I need this NOW or can it wait?"
3. **Complete Before Starting**: Finish tangent or explicitly pause it
4. **Document Blockers**: If stuck, document why and move on
5. **Weekly Review**: Clean up stale tangents every week

---

## 🔗 Related Documents

- [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) - Track all work streams and tangents
- [DEVELOPMENT_PROCESS.md](DEVELOPMENT_PROCESS.md) - Development workflow
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Overall project status

---

**Remember**: Tangents are features, not bugs. The goal is to manage them, not avoid them.
