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
│  │ 2. Run Router Agent to select optimal model                               │ │
│  │ 3. Call selected model via OpenRouter API                                 │ │
│  │ 4. Try fallback chain if primary model fails                              │ │
│  │ 5. Return { routerDecision, answer } to frontend                          │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Model Catalog    │   │   Router Agent    │   │ OpenRouter Service│
│ (modelCatalog.ts) │   │ (routerAgent.ts)  │   │ (openrouter.ts)   │
│  - Fetch models   │   │  - Analyze prompt │   │  - Call API       │
│  - Load capabil…  │   │  - Score models   │   │  - Fallbacks      │
│  - Cache 1 hour   │   │  - Select best    │   │                   │
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
4. **Prompt Analysis & Model Selection**:
   - Analyze prompt to detect task type (coding, translation, writing, etc.) ([`analyzePrompt()`](file:///d:/AI%20optimizer/orion/lib/routerAgent.ts#L24-L37))
   - Get top 8 models from catalog
   - Score each model using weighted criteria (see [How Models Are Selected](#how-models-are-selected))
   - Select model with highest overall value
5. **Estimate Tokens & Cost**:
   - `estimatedPromptTokens`: Math.ceil(prompt length / 4)
   - `estimatedCompletionTokens`: Based on complexity (low: 512, medium: 1024, high: 2048)
   - `estimatedCost`: (promptPrice × estimatedPromptTokens) + (completionPrice × estimatedCompletionTokens)
6. **Confidence Calculation**: Based on score difference between top model and second best
7. **Model Call**:
   - Try selected model first
   - If failed, try fallback chain: `meta-llama/llama-3.1-70b-instruct` → `google/gemini-2.0-flash-exp` → `openai/gpt-4o-mini`
8. **Response Display**: Show routing decision details and AI answer in frontend

---

## How Models Are Selected

Model selection is 100% deterministic (no AI for routing itself!). Each model is scored using weighted criteria:

### Score Components ([`calculateScore()`](file:///d:/AI%20optimizer/orion/lib/routerAgent.ts#L51-L104)):

| Component          | Weight | Description                                                                 |
|---------------------|--------|-----------------------------------------------------------------------------|
| **Task Fit**        | —      | How well model matches detected task type (e.g., coding → coding score)     |
| **Capability**      | ~20%   | (reasoning × 0.25) + (coding × 0.2) + (instructionFollowing × 0.2) + (jsonReliability × 0.15) + (longContext × 0.1) + (multilingual × 0.1) |
| **Quality**         | —      | (capability × 0.7) + (benchmarkScore × 0.3) (uses 80 if benchmark missing)  |
| **Latency**         | —      | 100 (low), 70 (medium), 40 (high)                                           |
| **Context**         | —      | 100 (≥128K tokens), 80 (≥32K), 60 (otherwise)                               |
| **Cost**            | —      | 100 (very cheap), 90 (cheap), 70 (medium), 40 (expensive)                   |
| **Overall Value**   | Final  | (taskFit × capability × quality) / (100000 × totalCost) → higher = better    |

### How We Pick the Winner:
All top 8 models are scored, then sorted by `overallValue` descending. The model with the highest score is selected!

---

## Cost & Token Optimization

Orion is optimized for cost from the ground up:

1. **Aggressive Token Limits**:
   - Router uses **anthropic/claude-3-haiku** (very cheap) instead of expensive models
   - Estimated completion tokens capped at reasonable levels based on complexity
2. **Value-Based Selection**:
   - Never picks an expensive model unless it provides significant quality improvement
   - Prioritizes models with high quality-to-cost ratio
3. **Smart Fallback Chain**:
   - Starts with most capable fallbacks, then moves to cheaper ones to maximize chance of success while keeping cost low
4. **Cached Model Catalog**:
   - Avoids repeated calls to OpenRouter's models API
   - Refreshes only once per hour

---

## Key Metrics Explained

| Metric                  | Calculation                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| **Task Type**           | Detected via keywords: coding, debugging, writing, translation, etc.        |
| **Complexity**          | low/medium/high based on whether reasoning/research or coding is needed     |
| **Estimated Cost**      | Exact cost estimate using OpenRouter's pricing formula                      |
| **Confidence**          | `clamp(50, 99, 50 + (topScore - secondBestScore) × 3.2)` → 50-99%          |
| **Quality Score**       | 0-100 score based on model capabilities                                     |
| **Cost Score**          | 0-100 score (100 = cheapest, 40 = most expensive)                           |
| **Value Score**         | 0-100 normalized version of `overallValue`                                  |

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
│   ├── modelCatalog.ts           # Model catalog management (fetch, merge, cache)
│   ├── openrouter.ts             # OpenRouter API client
│   ├── routerAgent.ts            # Core routing logic (score, select, estimate)
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

1. Copy `.env.example` to `.env`
2. Add your OpenRouter API key: `OPENROUTER_API_KEY=sk-or-v1-...`
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`
5. Visit `http://localhost:3000`
