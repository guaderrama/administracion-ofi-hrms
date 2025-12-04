# Development Commands & Snippets

> Comandos útiles organizados por categoría. Copia y pega según necesites.

---

## 🚀 Development Server

### Start Development
```bash
npm run dev
# or with different port
npm run dev -- --port 3001

# pnpm
pnpm dev

# yarn
yarn dev
```

### Build & Start Production
```bash
npm run build
npm run start

# or
pnpm build && pnpm start
```

### Development with Turbo
```bash
npx turbo dev
npx turbo build
```

---

## 🧪 Testing

### Run Tests
```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Specific file
npm run test path/to/test.spec.ts

# Update snapshots
npm run test -- -u
```

### E2E Tests (Playwright)
```bash
# Install browsers (first time)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in UI mode
npm run test:e2e:ui

# Run specific test
npx playwright test path/to/test.spec.ts
```

---

## 🎨 Code Quality

### Linting
```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check specific file
npx eslint path/to/file.ts
```

### Formatting (Prettier)
```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format

# Format specific file
npx prettier --write path/to/file.ts
```

### Type Checking
```bash
# TypeScript check
npm run typecheck

# Watch mode
npx tsc --watch --noEmit
```

---

## 🗄️ Database (Supabase)

### Local Development
```bash
# Start local Supabase (includes PostgreSQL, Auth, Storage)
npx supabase start

# Stop
npx supabase stop

# Restart
npx supabase restart

# Status
npx supabase status

# Access Studio
# Open http://localhost:54323 after start
```

### Migrations
```bash
# Create new migration
npx supabase migration new migration_name

# Apply migrations
npx supabase db push

# Reset database (WARNING: deletes all data)
npx supabase db reset

# Diff (compare local with remote)
npx supabase db diff
```

### Remote Database
```bash
# Link to project
npx supabase link --project-ref your-project-ref

# Pull schema from remote
npx supabase db pull

# Push to remote
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > types/supabase.ts
```

---

## 📦 Package Management

### npm
```bash
# Install dependencies
npm install

# Add package
npm install package-name

# Add dev dependency
npm install -D package-name

# Remove package
npm uninstall package-name

# Update packages
npm update

# Check outdated
npm outdated
```

### pnpm (faster, recommended)
```bash
# Install
pnpm install

# Add
pnpm add package-name

# Add dev
pnpm add -D package-name

# Remove
pnpm remove package-name

# Update
pnpm update
```

---

## 🌿 Git

### Basic Workflow
```bash
# Check status
git status

# Add files
git add .
git add path/to/file

# Commit
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in component"

# Push
git push origin main
git push origin feature/branch-name

# Pull
git pull origin main
```

### Branches
```bash
# Create new branch
git checkout -b feature/feature-name

# Switch branch
git checkout main
git checkout feature/branch-name

# List branches
git branch

# Delete branch
git branch -d feature/branch-name
git branch -D feature/branch-name  # force delete

# Merge
git checkout main
git merge feature/branch-name
```

### Undo Changes
```bash
# Discard changes in file
git checkout -- path/to/file

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Unstage file
git restore --staged path/to/file
```

### Stash
```bash
# Save changes temporarily
git stash

# List stashes
git stash list

# Apply last stash
git stash apply

# Apply specific stash
git stash apply stash@{0}

# Drop stash
git stash drop
```

---

## 🐛 Debugging

### Check Port Usage
```bash
# Mac/Linux
lsof -i :3000
lsof -ti:3000 | xargs kill -9  # Kill process

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F  # Kill process
```

### Logs
```bash
# Save dev logs to file
npm run dev 2>&1 | tee dev.log

# Tail logs
tail -f dev.log

# Search in logs
grep "error" dev.log
```

### Node Debugging
```bash
# Start with inspector
node --inspect-brk index.js

# Chrome DevTools
# Open chrome://inspect in Chrome
```

---

## 🔍 Search & Find

### Find Files
```bash
# Find by name
find . -name "*.tsx"
find . -name "component.tsx"

# Find and exec
find . -name "*.test.ts" -exec npm test {} \;

# Exclude node_modules
find . -path ./node_modules -prune -o -name "*.ts" -print
```

### Search in Files (grep)
```bash
# Search text in files
grep -r "searchTerm" .

# Ignore node_modules
grep -r "searchTerm" . --exclude-dir=node_modules

# Show line numbers
grep -rn "searchTerm" .

# Case insensitive
grep -ri "searchTerm" .
```

---

## 📊 Performance & Analysis

### Bundle Analysis
```bash
# Next.js bundle analyzer
npm run build
# Open analysis at http://localhost:8888

# Webpack bundle analyzer
npx webpack-bundle-analyzer
```

### Performance
```bash
# Lighthouse
npx lighthouse http://localhost:3000 --view

# Check package size
npx cost-of-modules
npx bundlephobia [package-name]
```

---

## 🔐 Environment Variables

### Create .env files
```bash
# Create .env.local
cat > .env.local << EOF
DATABASE_URL="your_database_url"
NEXT_PUBLIC_API_URL="http://localhost:3000"
SECRET_KEY="your_secret_key"
EOF

# Load env vars in terminal
source .env.local

# Or use dotenv
npx dotenv-cli npm run dev
```

---

## 🚀 Deployment

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod

# Check logs
vercel logs
```

### Docker
```bash
# Build image
docker build -t app-name .

# Run container
docker run -p 3000:3000 app-name

# Stop container
docker stop <container-id>

# Remove container
docker rm <container-id>
```

---

## 📝 Useful One-Liners

### File Operations
```bash
# Count lines of code
find . -name "*.ts" -o -name "*.tsx" | xargs wc -l

# Remove node_modules
find . -name "node_modules" -type d -prune -exec rm -rf {} +

# Find large files
find . -type f -size +10M

# Create component boilerplate
mkdir -p src/components/MyComponent && \
  touch src/components/MyComponent/{index.tsx,styles.module.css}
```

### Development
```bash
# Clear Next.js cache
rm -rf .next

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json && npm install

# Check memory usage
node --max-old-space-size=4096 --expose-gc
```

---

## 🎯 Project Specific

### Custom Scripts (Add to package.json)
```json
{
  "scripts": {
    "dev:debug": "NODE_OPTIONS='--inspect' next dev",
    "clean": "rm -rf .next node_modules",
    "fresh": "npm run clean && npm install",
    "type-check": "tsc --noEmit",
    "test:ci": "npm run lint && npm run type-check && npm run test",
    "db:seed": "tsx scripts/seed.ts",
    "db:migrate": "npx supabase migration up"
  }
}
```

---

## 💡 Tips

### Aliases (Add to ~/.zshrc or ~/.bashrc)
```bash
alias nrd="npm run dev"
alias nrb="npm run build"
alias nrt="npm run test"
alias gst="git status"
alias gaa="git add ."
alias gcm="git commit -m"
alias gp="git push"
alias gl="git pull"
```

### VS Code Shortcuts
```
Cmd/Ctrl + P         → Quick file open
Cmd/Ctrl + Shift + P → Command palette
Cmd/Ctrl + B         → Toggle sidebar
Cmd/Ctrl + `         → Toggle terminal
Cmd/Ctrl + /         → Toggle comment
Cmd/Ctrl + D         → Multi-cursor
```

---

## 📚 References

- Next.js CLI: https://nextjs.org/docs/app/api-reference/next-cli
- Supabase CLI: https://supabase.com/docs/guides/cli
- pnpm: https://pnpm.io/cli/install
- Git: https://git-scm.com/docs
