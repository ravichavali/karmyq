# Quick Reference - Development Workflow

**Last Updated**: 2025-12-28

---

## 🚀 Starting Any Work Session

1. **Read DEVELOPMENT_ROADMAP.md**
   - Check "Current Focus"
   - Review "Active Tangents"
   - Check "Backlog" for next tasks

2. **Before Making Changes**
   - Read DEVELOPMENT_PROCESS.md Pre-Change Checklist
   - Understand data flows in DATA_FLOWS.md
   - Run tests before changing code

3. **If Starting a Tangent**
   - Add to "Active Tangents" table in ROADMAP.md
   - Document parent work stream
   - Define return path

---

## 📋 Current Status (2025-12-28)

### ✅ What's Complete
- Mobile testing framework (Maestro)
- Web component unit testing (Jest/RTL)
- Polymorphic request rendering
- Process documentation
- Tangent management framework

### ⏸️ What's Pending (Your Action)
1. Run `cd apps/frontend && npm install`
2. Run `npm test` to verify 81 tests pass
3. Start app and verify polymorphic data displays

### 🎯 What's Next (Development)
- Visual regression testing
- Expand mobile test coverage
- Add more component unit tests
- CI/CD integration

---

## 🚨 Emergency Protocols

### Too Many Open Tangents?
1. **STOP** - Don't start new work
2. **LIST** - Check ROADMAP.md Active Tangents
3. **CHOOSE** - Pick ONE to close
4. **COMPLETE** - Finish or document blocker
5. **RETURN** - Go back to main path

**Rule**: Max 3 active tangents

### Lost Track of Goal?
1. Open ROADMAP.md
2. Read "Current Focus"
3. Read "Session Learning & Evolution"
4. Check last "Completed Tangents"
5. Resume from there

### Not Sure What to Work On?
1. Check ROADMAP.md "Backlog"
2. Pick highest priority item
3. Or ask user for priorities

---

## 📁 Essential Documents

| Document | When to Use |
|----------|-------------|
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | Every session start, track work |
| [DEVELOPMENT_PROCESS.md](DEVELOPMENT_PROCESS.md) | Before changing code |
| [DATA_FLOWS.md](architecture/DATA_FLOWS.md) | Before changing data structures |
| [TANGENT_MANAGEMENT.md](TANGENT_MANAGEMENT.md) | When tangent detected |
| [MOBILE_TESTING_GUIDE.md](testing/MOBILE_TESTING_GUIDE.md) | When testing mobile |
| [UI_TESTING_AUDIT.md](testing/UI_TESTING_AUDIT.md) | When planning UI tests |

---

## 🎯 Quick Decisions

### Should I Document This Tangent?
**YES if**:
- Working on something not in original task
- Building infrastructure for future
- Fixing something just discovered
- Taking more than 30 minutes

**Document in**: ROADMAP.md Active Tangents table

### Is This P0, P1, or P2?
- **P0 (Critical)**: Blocks current work, breaking production
- **P1 (High)**: Needed soon, important feature
- **P2 (Nice to have)**: Good idea, not urgent

### Should This Be in Backlog or Ideas?
- **Backlog**: Scoped, estimated, ready to work on
- **Ideas**: Discussed but needs more planning

---

## 🔄 Daily Workflow

### Morning (Starting Work)
```
1. Read ROADMAP.md Current Focus
2. Check Active Tangents (any open?)
3. Review Backlog (what's next?)
4. Start work or continue tangent
```

### During Work
```
1. Tangent detected? → Document it
2. Complete before starting new
3. Update status as you go
```

### Evening (Ending Work)
```
1. Move completed items to Completed
2. Update Active Tangents status
3. Add discoveries to Backlog
4. Update Current Focus if needed
```

---

## 📊 Success Indicators

**Good Signs**:
- ✅ Active Tangents table has ≤ 3 items
- ✅ Completed work moves to Completed table
- ✅ New ideas added to Backlog or Ideas
- ✅ Current Focus is clear
- ✅ Can explain what you're working on

**Warning Signs**:
- ❌ Active Tangents table has > 3 items
- ❌ Many incomplete items
- ❌ Unclear what the main goal is
- ❌ Discovering work but not documenting
- ❌ Building features not requested

---

## 🛠️ Common Commands

### Testing
```bash
# Frontend unit tests
cd apps/frontend
npm test

# Mobile E2E smoke tests
cd apps/mobile
npm run test:e2e:smoke

# All E2E tests
cd apps/frontend
cd ../tests
npm run test:e2e
```

### Development
```bash
# Start frontend
cd apps/frontend
npm run dev

# Start backend
docker-compose up -d

# View logs
docker logs karmyq-auth-service -f
```

### Data
```bash
# Reset database
cd scripts
truncate-database.bat

# Generate test data
npm run generate:realistic
```

---

## 🎓 Key Learnings

From Session 2025-12-28:

1. **Check roadmap FIRST** - prevents duplicate work
2. **Document tangents IMMEDIATELY** - prevents losing track
3. **Complete before starting new** - prevents fragmentation
4. **Use backlog for discoveries** - prevents forgetting good ideas
5. **Return to main path** - prevents scope creep

---

## 📞 Quick Help

**Lost track of work?**
→ Read ROADMAP.md "Session Learning & Evolution"

**Too many tangents?**
→ Read TANGENT_MANAGEMENT.md "Emergency Brake"

**Before changing code?**
→ Read DEVELOPMENT_PROCESS.md "Pre-Change Checklist"

**Need to understand data flow?**
→ Read DATA_FLOWS.md for the relevant flow

**Testing mobile app?**
→ Read MOBILE_TESTING_GUIDE.md

---

**Remember**:
- 🎯 Focus beats speed
- 📝 Documentation beats memory
- ✅ Completion beats starting
- 🔄 Process beats chaos
