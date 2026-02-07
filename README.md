# Lookfor Hackathon 2026 — logicsticks

> Multi-Agent System (MAS) for e-commerce email support automation

## What Is This?

This is a **standalone Multi-Agent System** — NOT a chatbot, NOT a Claude Code instance.

**Core Concept**: An LLM-powered orchestration system that:
1. Receives customer support emails
2. Classifies intent (order status? refund? subscription?)
3. Routes to specialized agents
4. Executes actions via Shopify/Skio APIs
5. Maintains memory across conversation
6. Escalates to humans when appropriate

## How It Works

```
Customer Email → Intent Classifier → Agent Router → LLM + Tools → Response
                       ↓                  ↓              ↓
                 [ORDER_STATUS]    [order-agent]   [get_order_details]
                 [REFUND_REQUEST]  [refund-agent]  [refund_order]
                 [ESCALATION]      [human-queue]   [stop auto-reply]
```

### The Two Steps

**Step 2 (Meta-System)** — Generates the MAS at build time:
- `workflow-parser` → Reads brand workflow documents
- `intent-extractor` → Learns patterns from historical tickets
- `agent-generator` → Creates agent configurations
- `mas-builder` → Assembles the complete MAS config

**Step 1 (MAS Runtime)** — Executes the MAS at runtime:
- `orchestrator` → Routes messages to appropriate agents
- `agent-executor` → Runs LLM with tools
- `tool-client` → Calls Shopify/Skio APIs
- `memory` → Maintains session context
- `tracing` → Observable action log

### Agent Architecture

Each agent is a **configuration**, not a separate process:

```typescript
{
  id: "order-tracking-agent",
  systemPrompt: "You are an order tracking specialist...",
  tools: ["shopify_get_order_details", "shopify_get_customer_orders"],
  boundaries: ["Never promise delivery dates", "Always verify order number"]
}
```

When a customer message arrives:
1. **Intent Classification**: Keyword matching determines intent (ORDER_STATUS, REFUND_REQUEST, etc.)
2. **Agent Selection**: Orchestrator picks the best agent for the intent
3. **LLM Execution**: Agent's system prompt + tools are sent to LLM (Claude/OpenAI/Gemini)
4. **Tool Loop**: LLM may call tools (API calls to Shopify/Skio)
5. **Response**: LLM generates final customer-facing response

### LLM as Brain

The LLM (Anthropic Claude by default) is the "brain" that:
- Reads customer message + conversation history
- Decides what action to take
- Calls tools when needed (get order status, process refund, etc.)
- Generates empathetic, brand-appropriate responses

**The LLM is NOT the agent** — it's the reasoning engine inside the agent.

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up
```

### Option 2: Local Development

```bash
npm install
npm run build

# Set your LLM API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start server
npm run dev

# In another terminal - run demo
npm run demo
```

### Demo with Mock API

For demos without backend connectivity:

```bash
# Start mock Lookfor API (simulates Shopify/Skio responses)
npm run mock-api

# In another terminal - run evaluation
npm run evaluate
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/session/start` | POST | Start email session with customer details |
| `/session/:id/message` | POST | Send customer message, get agent response |
| `/session/:id/trace` | GET | Get observable trace (all actions taken) |
| `/session/:id/summary` | GET | Get session summary |
| `/sessions` | GET | List active sessions |
| `/health` | GET | Health check |

### Example: Start Session

```bash
curl -X POST http://localhost:3000/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "shopifyCustomerId": "cust_123"
  }'
```

### Example: Send Message

```bash
curl -X POST http://localhost:3000/session/SESSION_ID/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Where is my order #NP1234567?"}'
```

## Requirements Compliance

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | **Email Session Start** | `POST /session/start` with customer details → session ID |
| 2 | **Continuous Memory** | Session-scoped memory with entity extraction (order numbers, dates) |
| 3 | **Observable Actions** | Tracer logs every decision, tool call, and routing event |
| 4 | **Escalation Mechanism** | Detects "speak to human" → stops auto-reply + generates summary |

## Agents (7 total)

| Agent | Purpose | Tools |
|-------|---------|-------|
| `order-tracking-agent` | Order status & tracking | get_customer_orders, get_order_details |
| `order-cancellation-agent` | Cancel orders | get_order_details, cancel_order |
| `refund-processing-agent` | Process refunds | get_order_details, refund_order |
| `subscription-management-agent` | Pause/skip/cancel subscriptions | get_subscription_status, pause, skip, cancel |
| `address-update-agent` | Update shipping addresses | get_order_details, update_shipping_address |
| `product-information-agent` | Product info & recommendations | get_product_details, get_recommendations |
| `general-support-agent` | General inquiries & fallback | get_related_knowledge_source |

## Tools (19 total)

**Shopify (14):**
- `add_tags`, `cancel_order`, `create_discount_code`, `create_return`
- `create_store_credit`, `get_collection_recommendations`, `get_customer_orders`
- `get_order_details`, `get_product_details`, `get_product_recommendations`
- `get_related_knowledge_source`, `refund_order`, `update_order_shipping_address`

**Skio (5):**
- `get_subscription_status`, `cancel_subscription`, `pause_subscription`
- `skip_next_order_subscription`, `unpause_subscription`

## Escalation

**Triggers:**
- Customer says "speak to human", "real person", "manager"
- Agent cannot safely determine action
- Multiple tool failures
- Sensitive financial disputes

**What happens:**
1. Customer receives: "I'm escalating this to our support team..."
2. Internal summary generated (session_id, customer, issue, attempted_resolution)
3. **All future auto-replies stopped** for this session

## Evaluation Metrics

Run `npm run evaluate` to see:

```
╔═══════════════════════════════════════════════════════════════╗
║                    EVALUATION RESULTS                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Intent Accuracy:     100%                                    ║
║  Tool Accuracy:       100%                                    ║
║  Escalation Accuracy: 100%                                    ║
║  Response Accuracy:   100%                                    ║
║  Avg Latency:         382ms                                   ║
╚═══════════════════════════════════════════════════════════════╝
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Claude API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (alternative) |
| `GOOGLE_API_KEY` | Yes* | Gemini API key (alternative) |
| `API_URL` | No | Lookfor tool API (default: provided endpoint) |
| `PORT` | No | Server port (default: 3000) |
| `USE_MOCK_API` | No | Use mock API for demos (default: false) |

*At least one LLM API key required

## Project Structure

```
hackaton_lookfor/
├── src/
│   ├── meta/                   # Step 2: Meta-system (generates MAS)
│   │   ├── tool-mapper/        # 19 tool definitions
│   │   ├── workflow-parser/    # Parse brand workflows
│   │   ├── intent-extractor/   # Learn intent patterns
│   │   ├── agent-generator/    # Generate agent configs
│   │   └── mas-builder/        # Assemble MAS config
│   ├── mas/                    # Step 1: MAS Runtime
│   │   ├── memory/             # Session memory store
│   │   ├── tracing/            # Observable action traces
│   │   ├── orchestrator/       # Intent router
│   │   ├── tools/              # Shopify/Skio API client
│   │   ├── agents/             # LLM agent executor
│   │   └── runtime.ts          # Main MAS runtime
│   ├── api/                    # HTTP server
│   │   ├── server.ts           # Express/Node server
│   │   └── mock-lookfor.ts     # Mock API for demos
│   └── brands/                 # Brand-specific configs
│       └── natpat.ts           # NATPAT workflows
├── scripts/
│   ├── evaluate.ts             # Evaluation suite
│   ├── demo.ts                 # Interactive demo
│   └── start-mock-api.ts       # Mock API launcher
├── tests/
│   └── mas.test.ts             # 19 passing tests
├── data/
│   └── tickets.json            # Historical tickets
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Testing

```bash
npm test              # Run all tests (19 passing)
npm run test:watch    # Watch mode
npm run evaluate      # Full evaluation with metrics
npm run debug:api     # Debug API connectivity
```

## For Judges: Quick Validation

### 1-Minute Test

```bash
# Clone and install
git clone <repo>
cd hackaton_lookfor
npm install

# Run judge evaluation (no API key needed)
npm run judge
```

Expected output:
```
  Total Tests:  19
  Passed:       19 ✅
  Score:        100.0%
```

### With Real LLM (2-Minute Test)

```bash
# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run full evaluation with real Claude
npm run judge
```

### Commands at a Glance

| Command | Purpose |
|---------|---------|
| `npm run judge` | Full requirement validation (19 tests) |
| `npm run evaluate` | Scenario evaluation with metrics |
| `npm test` | Unit tests (19 tests) |
| `npm run dev` | Start API server |
| `npm run mock-api` | Start mock Shopify/Skio API |

## For Judges: Key Points

1. **Self-Referential Design**: Step 2 (meta-system) generates Step 1 (runtime). The abstraction forces correctness.

2. **LLM-Agnostic**: Works with Claude, OpenAI, or Gemini. Just set the API key.

3. **Production-Ready**: No mocks in production code. Mock server is only for demos.

4. **Observable**: Every action is traced. Call `/session/:id/trace` to see full decision log.

5. **Safe Escalation**: When unsure or when customer requests, system stops and escalates with summary.

## Team

**logicsticks** — Building the meta-system that builds the system.

---

*"Step 2 before Step 1 — abstraction forces correctness."*
