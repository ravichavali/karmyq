# GitHub Project Board Setup Guide

This guide will help you set up a GitHub Project board for tracking Karmyq requirements and tasks.

## Step 1: Create the Project

1. Go to your repository on GitHub
2. Click the **"Projects"** tab
3. Click **"New project"**
4. Choose **"Board"** template
5. Name it: **"Karmyq Development"**
6. Click **"Create project"**

## Step 2: Configure Columns

Rename and organize the default columns:

### Column Structure
```
📋 Backlog  →  🎯 Ready  →  🏗️ In Progress  →  🧪 Testing  →  ✅ Done
```

### Column Purposes

**📋 Backlog**
- All new issues start here
- Unprioritized work
- Ideas and future enhancements

**🎯 Ready**
- Prioritized and ready to start
- Requirements documented
- No blockers

**🏗️ In Progress**
- Actively being worked on
- Assigned to team member
- Limit work in progress (WIP)

**🧪 Testing**
- Code complete
- Under review or QA
- Waiting for deployment

**✅ Done**
- Deployed to production
- Documented
- Closed

## Step 3: Add Custom Fields

Click **"Settings"** → **"Custom fields"**:

### Priority (Single select)
- 🔴 Critical
- 🟠 High
- 🟡 Medium
- 🟢 Low

### Service (Single select)
- Auth
- Community
- Request
- Reputation
- Notification
- Messaging
- Feed
- Cleanup
- Frontend
- Infrastructure

### Estimate (Number)
- Story points or days

### Milestone (Text)
- v5.2.0, v6.0.0, etc.

## Step 4: Add Existing Issues

1. Click **"+ Add item"**
2. Search for existing issues
3. Or create new issues from templates
4. Drag to appropriate column

## Step 5: Set Up Automation

GitHub Projects has built-in automation:

### Auto-add Issues
**Settings** → **Workflows** → **Item added to project**
- Automatically add to "Backlog" column

### Auto-move on Status Change
**Item closed** → Move to "Done"
**Pull request merged** → Move to "Done"

### Custom Workflows
You can create `.github/workflows/project-automation.yml` for advanced automation.

## Step 6: Create Initial Backlog

### Current Features (Documentation Tracking)
Create issues for each requirement to track documentation status:

```markdown
Title: Document FR-001: Authentication
Labels: documentation, epic
Description: Complete documentation for authentication system
- [ ] API documentation
- [ ] Security guide
- [ ] Testing guide
```

### Known Issues
Convert known issues into GitHub issues:

```markdown
Title: Stats tab requires page refresh
Labels: bug, service:community, priority:medium
Description: Stats don't load without refreshing...
```

### Future Enhancements
Add future features from requirement docs:

```markdown
Title: Implement refresh tokens
Labels: enhancement, service:auth, priority:low
Epic: #123 (link to auth epic)
```

## Step 7: Link to Requirements

In each issue, link to the requirement doc:

```markdown
## Requirements
See [FR-001: Authentication](/docs/requirements/functional/FR-001-authentication.md)

## Technical Design
See [TR-001: Microservices](/docs/requirements/technical/TR-001-microservices.md)
```

## Project Views

### Board View (Default)
Kanban-style columns for visual workflow

### Table View
Spreadsheet-like view with all fields
- Filter by service, priority, milestone
- Sort by any column
- Bulk edit

### Roadmap View (Optional)
Timeline view for release planning
- Requires start/end dates on issues

## Best Practices

### ✅ DO

- **Move cards regularly** - Keep board updated
- **Limit WIP** - Max 3-5 items in "In Progress"
- **Update estimates** - Refine as you learn
- **Close completed issues** - Don't let Done pile up
- **Use milestones** - Group by releases
- **Link PRs to issues** - Auto-close with "fixes #123"

### ❌ DON'T

- **Let backlog grow unbounded** - Prune regularly
- **Skip column** - Follow the workflow
- **Leave stale items** - Close or update
- **Forget to update** - Board reflects reality

## Sample Issue Creation Workflow

1. **User reports bug** → Create issue from bug template
2. **Triage** → Add labels, priority, service
3. **Add to project** → Automatically goes to Backlog
4. **Prioritize** → Move to Ready when ready to work
5. **Start work** → Assign and move to In Progress
6. **Create PR** → Reference issue: "fixes #123"
7. **PR merged** → Issue auto-moves to Done and closes

## Keyboard Shortcuts

- `c` - Create new issue
- `x` - Select item
- `/` - Focus search
- `cmd/ctrl + k` - Command palette

## Integration with VS Code

Install **GitHub Pull Requests and Issues** extension:
- View project board in VS Code
- Create issues from editor
- Link commits to issues

## Next Steps

1. **Push this guide** to GitHub
2. **Create the project board** following steps above
3. **Add 10-20 initial issues** to backlog
4. **Invite team members** to the project
5. **Start using it!** Move first issue to "In Progress"

## Resources

- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Project Automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project)
- [Best Practices](https://github.blog/2022-02-11-using-github-projects-for-project-management/)

---

**Questions?** Open an issue with the `question` label or ask in Discussions.
