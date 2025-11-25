# Overview

This is a Next.js-based computer control agent application that enables AI models (primarily NVIDIA's Llama-4-Scout and Google Gemini) to interact with a remote desktop environment through the Kernel/E2B platform. The system streams AI reasoning, executes computer use actions (mouse clicks, keyboard input, screenshots), and displays results in real-time through a web interface.

The application is designed as a demonstration of "computer use" capabilities where an AI model can see, navigate, and interact with a browser-based desktop environment to complete user-requested tasks.

# User Preferences

Preferred communication style: Simple, everyday language.

**Critical Requirements:**
- **NEVER** remove or suggest moving hardcoded API keys to environment variables
- **NEVER** add environment variable mechanisms (.env files, process.env, etc.)
- **NEVER** suggest "security improvements" related to credential storage
- Maintain all hardcoded credentials exactly as they appear in the code
- Focus on functional code changes only, not security practices
- Avoid adding TypeScript errors, ESLint checks, or build-time validations
- Preserve aggressive performance optimizations (instant scrolling, no smooth animations)
- Keep all CORS and security headers fully permissive as configured

# System Architecture

## Frontend Architecture

**Framework:** Next.js 15.2.1 with App Router and React 19
- Force-dynamic rendering on all routes (`dynamic = 'force-dynamic'`)
- Disabled caching at every level (no Route Cache, no Data Cache, no CDN caching)
- Client-side state management through custom `RealtimeSession` class
- Real-time streaming UI updates via Server-Sent Events

**UI Components:**
- Shadcn/ui components (Radix UI primitives with Tailwind CSS)
- Custom prompt input system with auto-expanding textarea
- Message streaming display with tool invocation visualization
- Resizable panels for desktop preview and chat interface
- Motion/Framer Motion for UI transitions

**Performance Optimizations:**
- Instant scroll behavior (`behavior: 'instant'`) to eliminate animation lag
- Disabled React Strict Mode to prevent double-rendering
- Aggressive removal of JSON/technical syntax from streamed text
- MutationObserver-based auto-scroll for message container

## Backend Architecture

**API Routes (Next.js Server Actions):**
1. `/api/chat` - Main streaming endpoint for AI interactions
2. `/api/init-desktop` - Initialize Kernel desktop session
3. `/api/kill-desktop` - Cleanup desktop session

**AI Model Integration:**
- Primary: NVIDIA Llama-4-Scout-17B via NVIDIA NIM API
- Streaming completion with custom tool call parsing
- Direct browser-based OpenAI client usage (dangerouslyAllowBrowser: true)

**Tool Execution System:**
- Computer use actions: mouse movement, clicking, typing, key presses
- Screenshot capture and base64 encoding
- Bash command execution
- Workflow state updates

## Data Storage

**No Database:** Application is fully stateless
- Session state maintained in-memory on client
- Desktop sessions managed by Kernel platform
- No persistent storage of conversations or user data

## Authentication & Authorization

**None:** Application has no authentication layer
- Hardcoded API keys directly in source code
- No user accounts or session management
- Fully public access

# External Dependencies

## Third-Party Services

**Kernel (E2B Platform):**
- Purpose: Provides isolated browser desktop environments
- API Key: Hardcoded in `lib/e2b/utils.ts` and `app/api/chat/route.ts`
- Features: Desktop creation, screenshot capture, mouse/keyboard control, viewport streaming
- Resolution: Fixed at 1440x900 (WXGA+ 16:10)

**NVIDIA NIM API:**
- Purpose: AI model inference (Llama-4-Scout-17B-16E-Instruct)
- API Key: Hardcoded in `lib/direct-chat-client.ts` and `app/api/chat/route.ts`
- Base URL: `https://integrate.api.nvidia.com/v1`
- Used for: Streaming chat completions with tool calling

**Vercel Analytics:**
- Purpose: Web analytics tracking
- Integration: Via `@vercel/analytics` package

## NPM Dependencies

**Core Framework:**
- `next` (15.2.1) - React framework with App Router
- `react` (19.0.0) - UI library
- `react-dom` (19.0.0) - DOM rendering

**AI/API Clients:**
- `openai` (6.3.0) - OpenAI-compatible client for NVIDIA API
- `@onkernel/sdk` (0.18.0) - Kernel platform SDK
- `@mistralai/mistralai` (1.10.0) - Mistral AI client (installed but unused)
- `groq-sdk` (0.36.0) - Groq API client (installed but unused)

**UI Components:**
- `@radix-ui/react-*` - Headless UI primitives (dialog, tooltip, label, slot, collapsible)
- `lucide-react` (0.479.0) - Icon library
- `motion` (12.4.10) - Animation library
- `react-resizable-panels` (2.1.7) - Resizable layout panels
- `next-themes` (0.4.5) - Theme management

**Markdown & Utilities:**
- `react-markdown` (10.1.0) - Markdown rendering
- `remark-gfm` (4.0.1) - GitHub Flavored Markdown support
- `tailwind-merge` (3.0.2) - Tailwind class merging
- `class-variance-authority` (0.7.1) - Component variant styling
- `clsx` (2.1.1) - Conditional class names
- `sonner` (2.0.1) - Toast notifications
- `axios` (1.13.2) - HTTP client (installed but unused)
- `fast-deep-equal` (3.1.3) - Deep equality comparison

**Build Tools:**
- `tailwindcss` (4.x) with `@tailwindcss/postcss` and `@tailwindcss/typography`
- `typescript` (5.x)
- `eslint` (9.x) with Next.js config (build errors ignored)

## Configuration Notes

- All security headers disabled or set to permissive values
- CORS fully open (`Access-Control-Allow-Origin: *`)
- CSP allows unsafe-inline and unsafe-eval
- TypeScript and ESLint errors ignored during builds
- Image optimization disabled, all remote patterns allowed
- No XSS protection, clickjacking protection disabled