# Claude Code Project Index

Welcome to the project documentation center!

## 📋 Project Setup Documentation

Start here to understand the project infrastructure:

### Quick References
1. **[INFRASTRUCTURE_SUMMARY.md](./INFRASTRUCTURE_SUMMARY.md)** - Overview of everything that was set up
2. **[docs/QUICK_START.md](./docs/QUICK_START.md)** - Quick start guide for common tasks

### Detailed Guides
1. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Complete architecture explanation
2. **[docs/FEATURE_TEMPLATE.md](./docs/FEATURE_TEMPLATE.md)** - Step-by-step feature creation guide
3. **[docs/GIT_WORKFLOW.md](./docs/GIT_WORKFLOW.md)** - Git branching and commit standards
4. **[docs/WORKFLOW.md](./docs/WORKFLOW.md)** - PLAN → DIFFS → VERIFY development process

---

## 🤖 AI Agent Commands

Custom slash commands for development workflows:

- **[commands/bucle-agentico.md](./commands/bucle-agentico.md)** - Agentic loop for feature development
- **[commands/explorador.md](./commands/explorador.md)** - Explore codebase patterns
- **[commands/ejecutar-prp.md](./commands/ejecutar-prp.md)** - Execute pull request workflow
- **[commands/generar-prp.md](./commands/generar-prp.md)** - Generate pull requests
- **[commands/arreglar-issue-github.md](./commands/arreglar-issue-github.md)** - Fix GitHub issues

---

## 🎯 Specialized Agents

Agents that automate specific tasks:

- **[agents/gestor-documentacion.md](./agents/gestor-documentacion.md)** - Documentation management
- **[agents/validacion-calidad.md](./agents/validacion-calidad.md)** - Quality validation and testing

---

## 🧠 Memory Management System

Keep context between sessions and track project progress:

### Session Tracking
- **[memory/NOTES.md](./memory/NOTES.md)** - Session notes and progress tracking
  - Current session status
  - Progress updates
  - Decisions made
  - Challenges encountered

### Task Organization
- **[memory/TODO.md](./memory/TODO.md)** - Organized task list with priorities
  - High priority (this week)
  - Medium priority (this month)
  - Low priority (backlog)

### Decision Log
- **[memory/DECISIONS.md](./memory/DECISIONS.md)** - Technical decisions documentation
  - Architecture choices
  - Technology selections
  - Design patterns
  - Trade-offs analyzed

### Issue Tracking
- **[memory/BLOCKERS.md](./memory/BLOCKERS.md)** - Problems blocking progress
  - Active blockers
  - Solutions attempted
  - Resolution status

**Usage:**
```
At session start: "Read .claude/memory/NOTES.md"
Update progress: "Update TODO.md: mark [task] completed"
Document decision: "Add to DECISIONS.md: chose PostgreSQL because..."
Track blocker: "Add to BLOCKERS.md: API not responding"
```

---

## 📋 Task Management

Detailed documentation for complex features:

- **[tasks/0001-template.md](./tasks/0001-template.md)** - Complete task documentation template
  - Objective and success criteria
  - Implementation plan
  - Technical details
  - Testing strategy
  - Verification commands

**Usage:**
```
Copy template: cp tasks/0001-template.md tasks/0002-auth-feature.md
Track feature: Document progress in task file
Reference: "Review tasks/0002-auth-feature.md for context"
```

---

## 💡 Code Snippets & Quick Reference

Fast access to common commands and configurations:

### Command Reference
- **[snippets/commands.md](./snippets/commands.md)** - Complete development commands
  - Development server commands
  - Testing commands
  - Database operations (Supabase)
  - Git workflows
  - Package management
  - Debugging techniques
  - Performance analysis

### Configuration Templates
- **[snippets/gitignore.txt](./snippets/gitignore.txt)** - Complete .gitignore template
  - Dependencies
  - Build outputs
  - Environment variables
  - IDE files
  - OS files
  - Claude/Cline system

**Usage:**
```
Find command: "Check snippets/commands.md for database reset"
Copy .gitignore: cp snippets/gitignore.txt ../.gitignore
Reference: Keep commands.md open while developing
```

---

## 🛠️ Skills & Tools

Specialized skills for building features:

### AI & ML
- **[skills/agent-builder-vercel-sdk/SKILL.md](./skills/agent-builder-vercel-sdk/SKILL.md)** - Build AI agents with Vercel SDK
- **[skills/agent-builder-pydantic-ai/SKILL.md](./skills/agent-builder-pydantic-ai/SKILL.md)** - Build AI agents with Pydantic
- **[skills/nano-banana-image-combine/SKILL.md](./skills/nano-banana-image-combine/SKILL.md)** - Image combination with AI
- **[skills/replicate-integration/SKILL.md](./skills/replicate-integration/SKILL.md)** - Replicate API integration

### Database & Auth
- **[skills/supabase-auth-memory/SKILL.md](./skills/supabase-auth-memory/SKILL.md)** - Supabase authentication and memory

### Web Development
- **[skills/nextjs-16-complete-guide/SKILL.md](./skills/nextjs-16-complete-guide/SKILL.md)** - Next.js 16 complete guide
- **[skills/skill-creator/SKILL.md](./skills/skill-creator/SKILL.md)** - Create custom skills

---

## 📚 Core Project Files

### Root Configuration
- **[../CLAUDE.md](../CLAUDE.md)** - Development principles and context
- **[../README.md](../README.md)** - Project overview
- **[../package.json](../package.json)** - Dependencies and scripts
- **[../tsconfig.json](../tsconfig.json)** - TypeScript configuration
- **[../next.config.js](../next.config.js)** - Next.js configuration
- **[../tailwind.config.ts](../tailwind.config.ts)** - Tailwind CSS config

### Source Code Structure
```
../src/
├── app/              # Next.js App Router (pages & routes)
├── features/         # Feature modules (your code goes here)
└── shared/           # Reusable utilities & components
```

---

## 🚀 Getting Started

### First Time Setup
1. Read [INFRASTRUCTURE_SUMMARY.md](./INFRASTRUCTURE_SUMMARY.md)
2. Review [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. Understand [docs/WORKFLOW.md](./docs/WORKFLOW.md) (PLAN → DIFFS → VERIFY)
4. Check [docs/QUICK_START.md](./docs/QUICK_START.md) for commands

### Daily Development Workflow
1. **Start session**: Read [memory/NOTES.md](./memory/NOTES.md) for context
2. **Check tasks**: Review [memory/TODO.md](./memory/TODO.md) for priorities
3. **Develop**: Follow [docs/WORKFLOW.md](./docs/WORKFLOW.md) process
4. **Reference**: Use [snippets/commands.md](./snippets/commands.md) for commands
5. **End session**: Update [memory/NOTES.md](./memory/NOTES.md) with progress

### For New Features
1. Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
2. Follow [docs/FEATURE_TEMPLATE.md](./docs/FEATURE_TEMPLATE.md)
3. Use [commands/bucle-agentico.md](./commands/bucle-agentico.md) workflow
4. Document in [tasks/](./tasks/) if complex

### For AI-Assisted Development
1. Use `/bucle-agentico` to start feature loops
2. Use `/explorador` to understand codebase
3. Use agents for quality validation and docs
4. Reference [docs/WORKFLOW.md](./docs/WORKFLOW.md) for structured development

---

## 🔄 Development Process (PLAN → DIFFS → VERIFY)

This project follows a structured workflow for all significant changes:

1. **PLAN** - Explain what will be done before doing it
2. **DIFFS** - Show exact changes before applying
3. **VERIFY** - Provide commands to validate changes work

See [docs/WORKFLOW.md](./docs/WORKFLOW.md) for complete details.

**Usage:**
```
"Use the workflow from WORKFLOW.md for this feature"
"Show me the PLAN before making changes"
"Give me VERIFY commands after applying"
```

---

## 📊 Project Stats

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **State**: Zustand
- **Testing**: Jest + React Testing Library

---

## ✅ Quick Checklist

### Initial Setup
- [ ] Read INFRASTRUCTURE_SUMMARY.md
- [ ] Review ARCHITECTURE.md
- [ ] Understand WORKFLOW.md
- [ ] Understand project structure
- [ ] Run `npm install`
- [ ] Create `.env.local` from `.env.example`
- [ ] Run `npm run dev` to start development
- [ ] Review CLAUDE.md for coding standards

### Daily Workflow
- [ ] Read memory/NOTES.md at session start
- [ ] Check memory/TODO.md for priorities
- [ ] Update progress in memory/NOTES.md
- [ ] Document decisions in memory/DECISIONS.md
- [ ] Track blockers in memory/BLOCKERS.md
- [ ] Use WORKFLOW.md process for changes
- [ ] Reference snippets/commands.md as needed

---

## 🎯 Common Tasks

Choose what you want to do:

### Documentation & Planning
1. **Review progress** → Read [memory/NOTES.md](./memory/NOTES.md)
2. **Check tasks** → See [memory/TODO.md](./memory/TODO.md)
3. **Understand decisions** → Read [memory/DECISIONS.md](./memory/DECISIONS.md)
4. **View blockers** → Check [memory/BLOCKERS.md](./memory/BLOCKERS.md)

### Development
1. **Start a new feature** → Read [docs/FEATURE_TEMPLATE.md](./docs/FEATURE_TEMPLATE.md)
2. **Understand the architecture** → Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. **Follow workflow** → Use [docs/WORKFLOW.md](./docs/WORKFLOW.md)
4. **Need commands** → Check [snippets/commands.md](./snippets/commands.md)

### Git & Collaboration
1. **Git workflow** → See [docs/GIT_WORKFLOW.md](./docs/GIT_WORKFLOW.md)
2. **Create PR** → Use [commands/generar-prp.md](./commands/generar-prp.md)
3. **Fix issue** → Use [commands/arreglar-issue-github.md](./commands/arreglar-issue-github.md)

### Advanced
1. **Create a custom skill** → See [skills/skill-creator/SKILL.md](./skills/skill-creator/SKILL.md)
2. **Complex feature** → Document in [tasks/](./tasks/)

---

## 💬 Working with Claude

### Essential Phrases

**Session Management:**
```
"Read .claude/memory/NOTES.md and let's continue"
"Update NOTES.md with today's progress"
"Add to TODO.md: [new task]"
```

**Development Process:**
```
"Use the WORKFLOW.md process for this feature"
"Follow PLAN → DIFFS → VERIFY workflow"
"Show me the PLAN before implementing"
```

**Quick Reference:**
```
"Check snippets/commands.md for [command type]"
"What's the command for [action]?"
"How do I [task]? Check snippets"
```

**Decision Making:**
```
"Document this decision in DECISIONS.md"
"Why did we choose [X]? Check DECISIONS.md"
```

**Problem Solving:**
```
"Add blocker to BLOCKERS.md: [issue]"
"Check BLOCKERS.md for similar issues"
```

---

## 🎓 Learning Resources

### For Claude
- Read [../CLAUDE.md](../CLAUDE.md) for project context
- Check [memory/](./memory/) for project history
- Reference [docs/](./docs/) for detailed guides
- Use [snippets/](./snippets/) for quick commands

### For Developers
- Start with [docs/QUICK_START.md](./docs/QUICK_START.md)
- Follow [docs/WORKFLOW.md](./docs/WORKFLOW.md)
- Reference [snippets/commands.md](./snippets/commands.md)
- Track work in [memory/](./memory/)

---

**Last Updated**: Nov 4, 2025
**Status**: ✅ Infrastructure Ready | 🧠 Memory System Active | 🔄 Workflow Integrated
