# Orion AI Router

Orion is an explainable AI routing engine that automatically selects the most cost-effective LLM for your task while maintaining high output quality.

## Key Features

- **Cost-Aware Routing**: Always selects the cheapest model that can sufficiently complete the task
- **Explainable Decisions**: Provides clear reasoning for model selection
- **Fallback System**: Graceful degradation with fallback models
- **Real-Time Pricing**: Fetches live pricing from OpenRouter
- **Semantic Capabilities**: Uses human-readable capability descriptions instead of arbitrary scores
- **Validation & Retries**: Zod validation, timeouts, and automatic retries for transient errors

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenRouter API
- Zod (schema validation)

## Architecture Overview

### 1. Model Catalog (`lib/modelCatalog.ts`)

- **Initialization**: Fetches live model data from OpenRouter on first request
- **Caching**: Stores model catalog in memory
- **Auto-Refresh**: Automatically refreshes model catalog every hour
- **Top Candidates**: Filters and prioritizes models to keep router prompt size manageable
- **Fallback Model**: Provides a reliable fallback model (GPT-4o Mini)

### 2. Capabilities Registry (`config/capabilities.json`)

- **Semantic Descriptions**: Uses human-readable notes instead of numeric scores
- **Preferred Tasks**: Lists task types each model excels at
- **Extensible**: Easy to add new models or update capabilities
- **Separation of Concerns**: Keeps pricing dynamic from OpenRouter, capabilities static

### 3. Router Agent (`lib/routerAgent.ts`)

- **Cheap Router**: Uses Llama 3.1 8B Instruct for routing decisions
- **Tradeoff Analysis**: Considers cost, quality, context length, and task complexity
- **Zod Validation**: Validates all router responses
- **Fallback System**: Falls back to default response if router fails

### 4. OpenRouter Service (`lib/openrouter.ts`)

- **Timeout Protection**: 30-second timeout for all requests
- **Automatic Retries**: Retries once for transient errors (429, 500, 502, 503, 504)
- **Type Safety**: Full TypeScript types for all requests and responses

### 5. API Route (`app/api/chat/route.ts`)

- **Clean Orchestration**: Orchestrates flow without containing business logic
- **Fallback Logic**: Tries fallback model if selected model fails
- **Error Handling**: Graceful error handling with clear messages

## Why This Architecture?

### Why OpenRouter?

- Single API access to hundreds of models
- Real-time pricing data
- Unified interface for all providers
- No need to manage multiple API keys

### Why Dynamic Pricing?

- Pricing changes frequently
- Always uses the latest available prices
- Avoids hardcoding outdated costs

### Why AI-Based Routing (Not If-Else)?

- Handles edge cases better
- Adapts to new models without code changes
- More flexible and scalable
- Can consider complex tradeoffs (context length, multimodal, etc.)

### Why Semantic Capabilities?

- Numeric scores are arbitrary and hard to maintain
- Human-readable descriptions are more intuitive
- Easier to update and reason about
- Better for the router agent to interpret

## Getting Started

1. **Install dependencies**:

```bash
npm install
```

2. **Set up environment variables**:

Create a `.env` file:

```env
OPENROUTER_API_KEY=your-openrouter-api-key
```

3. **Run the dev server**:

```bash
npm run dev
```

4. **Open your browser**:

Visit [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter your prompt in the large textarea
2. Click "Ask Orion" or press Enter
3. View the routing decision with explanation
4. See the AI response from the selected model

## Project Structure

```
orion/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Main API endpoint
│   ├── globals.css                # Tailwind + shadcn styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Home page UI
├── components/
│   └── ui/                        # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       └── textarea.tsx
├── config/
│   └── capabilities.json          # Model capabilities (semantic)
├── lib/
│   ├── modelCatalog.ts            # Model catalog management
│   ├── openrouter.ts              # OpenRouter API client
│   ├── routerAgent.ts             # AI router agent
│   └── utils.ts                   # Utility functions
├── types/
│   └── index.ts                   # TypeScript type definitions
└── .env                           # Environment variables
```

## License

MIT
