# Gemini CLI WebUI v0.2

A modern, full-featured web interface for Gemini CLI with enhanced visualization, real-time tool execution, and intelligent ReAct reasoning.

[中文说明](./README_CN.md) | [Project Progress](./继续.md)

## 🎯 Project Overview

This is a complete rewrite of the Gemini CLI WebUI, built from the ground up with a focus on:

- **Full CLI Integration**: Multiple adapters for integrating with Google Gemini CLI
- **Enhanced Visualization**: Beautiful, animated UI components for tool execution and reasoning
- **ReAct Engine**: Intelligent reasoning with Thought-Action-Observation cycles
- **Real-time Communication**: WebSocket-based real-time messaging and status updates
- **Memory Management**: GEMINI.md file management for context persistence
- **Modern Architecture**: TypeScript monorepo with strict type safety

## ✨ Latest Updates (2025-06-28)

### 🆕 Real Gemini CLI Integration
- **Multiple Adapter Support**: Choose between Mock, Subprocess, Core, or API adapters
- **Subprocess Adapter**: Run real gemini-cli as a child process
- **Core Adapter**: Direct integration with gemini-cli core modules
- **Configuration System**: Easy setup with environment variables

### 🎨 New Visualization Components
- **ReActThinkingEnhanced**: Animated reasoning process with typing effects
- **ToolExecutionLogsEnhanced**: Real-time execution logs with progress tracking
- **ToolExecutionMonitor**: Dashboard for monitoring active tool executions
- **ErrorDisplay**: Beautiful error and warning visualization

Visit `/demo/visualization` to see all components in action!

## 🏗️ Architecture

### Monorepo Structure

```
v0.2 code webui/
├── packages/
│   ├── shared/           # Shared types, utilities, and constants
│   ├── cli-integration/  # Gemini CLI integration layer
│   ├── backend/          # Express + Socket.IO server
│   └── frontend/         # React 18 + Vite application
├── docs/                 # Documentation
├── tests/               # Integration and E2E tests
└── tools/               # Development tools and scripts
```

### Technology Stack

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **WebSocket**: Socket.IO for real-time communication
- **ReAct Engine**: Custom implementation for reasoning
- **Validation**: Zod for runtime type checking
- **Security**: Multi-tier approval system with sandboxed execution

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **UI Components**: shadcn/ui with Tailwind CSS
- **Animation**: Framer Motion for smooth animations
- **State Management**: Zustand for reactive state
- **WebSocket Client**: Socket.IO client with connection management

#### Development
- **Package Manager**: pnpm with workspaces
- **Build System**: Turbo for efficient monorepo builds
- **Code Quality**: ESLint + Prettier with strict TypeScript
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Git Hooks**: Husky + lint-staged for pre-commit quality checks

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm 8 or higher
- @google/gemini-cli (optional, for real integration)
- Docker (optional, for sandbox execution)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd "v0.2 code webui"

# Install dependencies
pnpm install

# (Optional) Install gemini-cli for real integration
npm install -g @google/gemini-cli

# Quick setup
pnpm setup

# Start development servers
pnpm dev        # Use mock adapter (default)
pnpm dev:real   # Use real gemini-cli
pnpm dev:core   # Use core integration
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Gemini API Configuration
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-pro

# Adapter Configuration
# Options: mock, subprocess, core, api
GEMINI_ADAPTER_TYPE=mock

# If using subprocess adapter
GEMINI_EXECUTABLE_PATH=gemini

# Optional
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
WS_PORT=8080
```

See `.env.example` for all available options.

## 🔌 Adapter System

Gemini CLI WebUI supports multiple integration methods:

### Mock Adapter (Default)
- Perfect for development and testing
- No API key required
- Simulates all responses

### Subprocess Adapter
- Runs real gemini-cli as a child process
- Full feature support including MCP and sandboxing
- Requires gemini-cli to be installed

### Core Adapter
- Direct integration with gemini-cli modules
- Best performance
- Type-safe integration

### API Adapter (Coming Soon)
- Connect to remote gemini-cli instances
- Suitable for distributed deployments

For detailed integration instructions, see [INTEGRATION.md](./docs/INTEGRATION.md).

## 🎨 Key Features

### 1. Enhanced ReAct Reasoning Visualization
- **Step-by-step visualization** of the thinking process
- **Animated transitions** between thoughts, actions, and observations
- **Real-time typing effects** for a more engaging experience
- **Progress tracking** for each reasoning step
- **Statistical overview** of the reasoning process

### 2. Advanced Tool Execution Monitoring
- **Real-time progress bars** for tool execution
- **Execution statistics** including success rate and average duration
- **Pause/resume functionality** for log streaming
- **Error highlighting** with intelligent suggestions
- **Export capabilities** for logs and execution history

### 3. Memory Management System
- **GEMINI.md file support** for project and global context
- **Search and edit** capabilities within the UI
- **Automatic context loading** for improved conversation continuity

### 4. Beautiful Error Handling
- **Categorized display** of errors, warnings, and info messages
- **Expandable details** with stack traces and context
- **One-click retry** functionality
- **Copy error details** for easy reporting

## 📦 Package Overview

### @gemini-cli-webui/shared
Core shared functionality including:
- **TypeScript Types**: Comprehensive type definitions for all entities
- **Validation Schemas**: Zod schemas for runtime validation
- **Utilities**: Common utility functions and helpers
- **Constants**: Application constants and configuration

### @gemini-cli-webui/backend
Express.js backend server:
- **REST API**: RESTful endpoints for core functionality
- **WebSocket Server**: Real-time communication with Socket.IO
- **ReAct Engine**: Reasoning and acting implementation
- **Tool Service**: Handles tool execution and approval
- **Memory Service**: GEMINI.md file management

### @gemini-cli-webui/frontend
React application:
- **Modern UI**: Clean, responsive interface with dark mode support
- **Real-time Updates**: Live message streaming and status updates
- **Enhanced Visualizations**: Animated components for better UX
- **Tool Approval**: Interactive tool execution approval dialogs
- **State Management**: Optimistic updates with offline support

## 🔒 Security Features

### Multi-Tier Approval System
- **Auto Approval**: Safe operations proceed automatically
- **User Approval**: Potentially risky operations require user confirmation
- **Admin Approval**: High-risk operations require administrator approval

### Sandboxed Execution (Planned)
- **Container Isolation**: Tool execution in isolated Docker containers
- **Resource Limits**: CPU, memory, and execution time constraints
- **Network Controls**: Restricted network access with allowlists

## 📊 Development Status

### ✅ Completed
- [x] Project structure and monorepo setup
- [x] Basic chat interface
- [x] Tool system framework
- [x] Memory management (GEMINI.md)
- [x] Enhanced visualization components
- [x] WebSocket real-time communication
- [x] Error handling improvements

### 🚧 In Progress
- [ ] ReAct Engine integration with chat flow
- [ ] Real gemini-cli core integration
- [ ] Complete MCP protocol implementation

### 📋 Upcoming
- [ ] Performance optimizations
- [ ] Testing coverage
- [ ] Documentation improvements
- [ ] Production deployment setup

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Check test coverage
pnpm test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork and Clone**: Fork the repository and clone locally
2. **Install Dependencies**: Run `pnpm install`
3. **Create Branch**: Create a feature branch from `main`
4. **Develop**: Make your changes with tests
5. **Quality Check**: Run `pnpm lint` and `pnpm test`
6. **Submit PR**: Create a pull request with description

### Code Standards

- **TypeScript**: Strict mode with comprehensive type coverage
- **Testing**: All new features must include tests
- **Documentation**: Update docs for public API changes
- **Commits**: Use conventional commit messages

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [Gemini CLI](https://github.com/google/gemini-cli)
- [Documentation](./docs/)
- [Visualization Improvements](./VISUALIZATION_IMPROVEMENTS.md)
- [Issue Tracker](https://github.com/gemini-cli/webui/issues)

---

**Built with ❤️ for the Gemini CLI community**