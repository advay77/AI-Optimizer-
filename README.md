# Orion AI Router

Orion is a smart AI model router that automatically selects the best LLM for your prompt based on cost, quality, latency, and capability — all optimized for value!

---

## Table of Contents

1. [Architecture](#architecture)
2. [Data Flow](#data-flow)
3. [How Models Are Selected](#how-models-are-selected)
4. [Cost & Token Optimization](#cost--token-optimization)
5. [Key Metrics](#key-metrics)
6. [Directory Structure](#directory-structure)
7. [Setup](#setup)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   Frontend                                      │
│                              (app/page.tsx)                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ Prompt Input → Loading State → Response Display                           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ POST /api/chat
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Backend API Route                                     │
│                        (app/api/chat/route.ts)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Initialize Model Catalog (if not cached)                               │ │
│  │ 2. Run Router Pipeline (modular) to select optimal model                  │ │
│  │ 3. Call selected model via OpenRouter API                                 │ │
│  │ 4. Try fallback chain if primary model fails                              │ │
│  │ 5. Return { routerDecision, answer } to frontend                          │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Model Catalog    │   │   Router Pipeline │   │ OpenRouter Service│
│ (modelCatalog.ts) │   │  (lib/router/)    │   │ (openrouter.ts)   │
│  - Fetch models   │   │  - Prompt Profiler│   │  - Call API       │
│  - Load capabil…  │   │  - Candidate Filt │   │  - Fallbacks      │
│  - Cache 1 hour   │   │  - Task Weights   │   │                   │
│                   │   │  - Scoring        │   │                   │
│                   │   │  - Tie Breaker    │   │                   │
│                   │   │  - Confidence     │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Data Flow

Here's exactly what happens step by step when a user sends a prompt:

1. **User Input**: User enters prompt in frontend ([`page.tsx`](file:///d:/AI%20optimizer/orion/app/page.tsx))
2. **API Request**: Frontend sends POST request to `/api/chat` with prompt
3. **Model Catalog Initialization**:
   - If not cached, fetch all available models from OpenRouter API ([`openrouter.ts`](file:///d:/AI%20optimizer/orion/lib/openrouter.ts))
   - Merge with predefined capabilities from [`config/capabilities.json`](file:///d:/AI%20optimizer/orion/config/capabilities.json)
   - Cache for 1 hour
4. **Router Pipeline**:
   - Step 1: Profile the prompt (detect task type, complexity, requirements) ([`promptProfiler.ts`](file:///d:/AI%20optimizer/orion/lib/router/promptProfiler.ts))
   - Step 2: Filter eligible candidates (remove models that don't meet requirements) ([`candidateFilter.ts`](file:///d:/AI%20optimizer/orion/lib/router/candidateFilter.ts))
   - Step 3: Get task‑specific weights for scoring ([`taskWeights.ts`](file:///d:/AI%20optimizer/orion/lib/router/taskWeights.ts))
   - Step 4: Score each eligible model ([`scorer.ts`](file:///d:/AI%20optimizer/orion/lib/router/scorer.ts))
   - Step 5: Break ties (provider diversity, latency) ([`tieBreaker.ts`](file:///d:/AI%20optimizer/orion/lib/router/tieBreaker.ts))
   - Step 6: Calculate confidence in selection ([`confidence.ts`](file:///d:/AI%20optimizer/orion/lib/router/confidence.ts))
5. **Estimate Tokens & Cost**:
   - `estimatedPromptTokens`: Math.ceil(prompt length / 4)
   - `estimatedCompletionTokens`: Based on complexity (low: 512, medium: 1024, high: 2048)
   - `estimatedCost`: (promptPrice × estimatedPromptTokens) + (completionPrice × estimatedCompletionTokens)
6. **Model Call**:
   - Try selected model first
   - If failed, try fallback chain: `meta-llama/llama-3.1-70b-instruct` → `google/gemini-2.0-flash-exp` → `openai/gpt-4o-mini`
7. **Response Display**: Show routing decision details and AI answer in frontend

---

## How Models Are Selected

Model selection is 100% deterministic (no AI for routing itself!).

### Step 1: Prompt Profiler
Extracts task type, complexity, reasoning/coding/multimodal requirements, etc.

### Step 2: Candidate Filter
Hard requirements remove unsuitable models early:
- Coding tasks: coding score ≥ 70 (high) or ≥ 50 (medium)
- Translation: multilingual score ≥ 60
- Multimodal: model must support multimodal input
- Long context: model's context window ≥ required tokens
- Rejects deprecated, free, or incomplete models

### Step 3: Task‑Specific Scoring
Each task type uses different weights! Examples ([`taskWeights.ts`](file:///d:/AI%20optimizer/orion/lib/router/taskWeights.ts)):

| Task Type       | Key Weights                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| **Coding**      | coding (40%), reasoning (25%), instruction following (15%), JSON (10%)     |
| **Writing**     | instruction following (35%), reasoning (25%), multilingual (15%), latency (15%), cost (10%) |
| **Translation** | multilingual (45%), instruction following (25%), reasoning (15%)           |
| **Architecture**| reasoning (40%), coding (30%), context (15%)                               |
| **Simple Tasks**| instruction following (30%), latency (30%), cost (25%)                     |

### Step 4: Tie Breaker
If top scores differ by ≤ 3 points, selects based on:
1. Provider diversity (different provider than last used model)
2. Lower latency

### Step 5: Confidence Calculation
```typescript
confidence = 50 + (scoreGap * 2.5) 
           - (taskAmbiguity * 0.2) 
           - (if candidates > 5 and scoreGap <5 ? 10 : 0)
clamp 0‑100
```

---

## Cost & Token Optimization

Orion is optimized for cost from the ground up:

1. **Aggressive Token Limits**:
   - Estimated completion tokens capped at 1024 max to stay within budget
2. **Value-Based Selection**:
   - Task‑specific weights ensure we pick the right tool for the job (not just the most expensive model)
   - Quality‑first, but cost is a factor in tie breaks and simple tasks
3. **Smart Fallback Chain**:
   - Starts with capable fallbacks, then moves to cheaper ones
4. **Cached Model Catalog**:
   - Avoids repeated calls to OpenRouter's models API
   - Refreshes only once per hour

---

## Key Metrics Explained

| Metric                  | Source / Calculation                                                                 |
|-------------------------|-------------------------------------------------------------------------------------|
| **Task Type**           | Detected via keywords (coding, debugging, writing, translation, etc.)               |
| **Complexity**          | low/medium/high based on word count and keywords (see [`promptProfiler.ts`](file:///d:/AI%20optimizer/orion/lib/router/promptProfiler.ts#L31-L37)) |
| **Estimated Cost**      | Exact cost estimate using OpenRouter's pricing formula                              |
| **Confidence**          | See [Step 5 in Data Flow](#data-flow)                                              |
| **Quality Score**       | Average of model capabilities (reasoning, coding, instruction following, etc.)      |

---

## Directory Structure

```
orion/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Backend API route (POST /api/chat)
│   ├── globals.css
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Frontend home page
├── components/
│   └── ui/                       # Shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       └── textarea.tsx
├── config/
│   └── capabilities.json         # Predefined model capabilities (reasoning, coding, etc.)
├── lib/                          # Core business logic
│   ├── router/                   # Modular router pipeline
│   │   ├── index.ts              # Pipeline orchestration + exports
│   │   ├── promptProfiler.ts     # Prompt analysis (task type, complexity, requirements)
│   │   ├── candidateFilter.ts    # Filter eligible candidates based on requirements
│   │   ├── taskWeights.ts        # Task‑specific scoring weights
│   │   ├── scorer.ts             # Weighted scoring of eligible models
│   │   ├── tieBreaker.ts         # Intelligent tie breaking
│   │   ├── confidence.ts         # Calculate confidence in selection
│   │   └── diagnostics.ts        # Detailed logging and diagnostics
│   ├── modelCatalog.ts           # Model catalog management (fetch, merge, cache)
│   ├── openrouter.ts             # OpenRouter API client
│   ├── routerAgent.ts            # Compatibility layer (uses new router pipeline)
│   └── utils.ts
├── public/
├── types/
│   └── index.ts                  # TypeScript interfaces & types
├── .env                          # Environment variables (API keys)
├── tsconfig.json
└── package.json
```

---

## Setup

1. Copy `.env.example` to `.env` (create it if needed: `OPENROUTER_API_KEY=sk-or-v1-...`)
2. Add your OpenRouter API key to `.env`
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`
5. Visit `http://localhost:3000`
