# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application for an AI character transformation experience. Users take photos, select a character role, and use AI face-swap technology to transform into historical Korean naval characters. The app generates photo cards of the transformed images.

## Development Commands

```bash
# Development with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Architecture

### Technology Stack
- **Framework**: Next.js 15.3.2 with App Router
- **React**: 19.0.0 (Client Components)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives
- **State Management**: Zustand
- **Image Processing**: Sharp, html2canvas, dom-to-image-more

### Key Application Flow

1. **Password Authentication** (`/`)
   - Protected by middleware using httpOnly cookies (`auth_verified`)
   - Password stored in Supabase `password` table
   - All routes except root require authentication

2. **User Journey**
   - `/` → Home (password gate)
   - `/intro` → Introduction/consent
   - `/select` → Character role selection
   - `/camera` → Photo capture
   - `/character/[id]` → AI face-swap processing
   - `/complete` → Final result with photo card

3. **Face Swap Flow**
   - User uploads photo via `/api/upload-photo`
   - Face swap initiated via `/api/face-swap` (returns job_id)
   - Status polling via `/api/job-status/[jobId]`
   - Utility functions in `utils/faceSwap.ts` handle polling logic
   - Results stored in Supabase `image` table with job_id reference

### Supabase Integration

**MCP Server Configuration**: `.mcp.json` contains Supabase MCP server for database operations.

**Database Tables**:
- `password` - App authentication
- `character` - Character definitions with prompts, abilities, images
- `image` - Generated face-swap results (job_id, result jsonb)
- `camera_history` - Photo upload history
- `messages` - Random messages for UI
- `logs` - Character usage logs
- `statistics` - User statistics

**Client Patterns**:
- Browser client: `utils/supabase/client.ts` (createBrowserClient)
- Server client: `utils/supabase/server.ts` (for server components/API routes)
- Environment variables required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Middleware & Authentication

`middleware.ts` protects all routes except `/` and API routes. Authentication uses httpOnly cookies set by `/api/verify-password`. Unauthenticated users are redirected to root.

### API Routes

Key endpoints:
- `/api/verify-password` - Validates password against Supabase, sets auth cookie
- `/api/check-auth` - Returns authentication status
- `/api/face-swap` - Initiates face swap job
- `/api/job-status/[jobId]` - Polls face swap status
- `/api/upload-photo` - Handles image uploads
- `/api/characters` - CRUD for character data
- `/api/messages/random` - Random message retrieval

### Image Optimization

Next.js configured for Supabase storage URLs with formats: webp, avif. Remote patterns allow `*.supabase.co/storage/v1/object/public/**`.

### UI Components

- Custom components in `app/components/`
- Radix UI primitives in `components/ui/`
- Consistent color scheme: `#E4BE50` (gold), `#F7D5AA` (beige), `#451F0D` (brown)
- Custom font: MuseumClassic (loaded via CSS)
- Global components: GoBack button, BackgroundMusic, Toaster

### State & Utilities

- Zustand stores for state management
- `utils/faceSwap.ts` - Face swap request/polling logic
- `utils/imagePolling.ts` - Image status polling
- `utils/imageCompression.ts` - Image optimization
- `utils/camera.ts` - Camera utilities

## Important Patterns

1. **All page components are Client Components** (`"use client"`) due to interactive nature
2. **Polling pattern**: Face swap operations use polling with `pollJobStatus` (5s interval, 60 max attempts)
3. **Error handling**: API routes return structured responses with `success`, `error`, `message` fields
4. **Image uploads**: Use Supabase Storage with presigned URLs
5. **TypeScript**: Strictly typed, interfaces in component files or separate type files

## Environment Setup

Required variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Notes

- Body size limit for API routes: 50MB (configured in next.config.ts)
- Middleware excludes static assets and API routes from auth checks
- Password authentication is single-password system (not per-user)
- Face swap jobs are asynchronous - always use polling pattern
