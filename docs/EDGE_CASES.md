# Edge Cases & Error Handling

> Comprehensive documentation of all edge cases, error scenarios, and handling strategies.

---

## Error Code Reference

| Range | Category | Description |
|-------|----------|-------------|
| E1xxx | Session | Session lifecycle errors |
| E2xxx | Tool | Tool execution errors |
| E3xxx | Routing | Agent routing errors |
| E4xxx | Escalation | Escalation handling errors |
| E5xxx | Validation | Input validation errors |
| E6xxx | LLM | LLM API errors |
| E7xxx | Config | Configuration errors |
| E8xxx | Storage | File persistence errors |

---

## 1. Session Edge Cases

### E1001: Session Not Found

**Trigger:** Message sent to non-existent session ID

**Symptoms:**
- API returns 500 with "Session not found: {id}"
- Customer receives no response

**Handling:**
```typescript
// Check before processing
const session = memoryStore.getSession(sessionId);
if (!session) {
  throw SessionError.notFound(sessionId);
}
```

**Recovery:**
- Start new session with `POST /session/start`
- Re-authenticate customer if needed

---

### E1002: Session Already Escalated

**Trigger:** Message sent to escalated session

**Symptoms:**
- API returns early with escalation message
- No agent processing occurs

**Handling:**
```typescript
if (memoryStore.isEscalated(sessionId)) {
  return {
    sessionId,
    message: 'This issue has been escalated to our team.',
    escalated: true,
    escalationSummary: session.context.escalationSummary
  };
}
```

**Recovery:**
- Human agent must respond
- Can resolve session to re-enable automation

---

### E1003: Session Expired

**Trigger:** Session idle beyond timeout (default: 24h)

**Symptoms:**
- Old session ID returns not found
- Context lost

**Handling:**
```typescript
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
if (Date.now() - new Date(session.startedAt).getTime() > MAX_SESSION_AGE_MS) {
  throw SessionError.expired(sessionId);
}
```

**Recovery:**
- Start fresh session
- Customer may need to re-explain issue

---

### E1004: Session Invalid State

**Trigger:** Operation attempted in wrong session state

**Examples:**
- Trying to resolve an already resolved session
- Processing message on resolved session

**Handling:**
```typescript
if (session.status === 'resolved') {
  throw SessionError.invalidState(sessionId, 'active', 'resolved');
}
```

**Recovery:**
- Check session status before operations
- Start new session if needed

---

## 2. Tool Execution Edge Cases

### E2001: Tool Not Found

**Trigger:** LLM requests non-existent tool

**Symptoms:**
- Tool call returns `{ success: false, error: "Unknown tool: X" }`

**Handling:**
```typescript
const tool = getToolByHandle(toolHandle);
if (!tool) {
  return ToolError.notFound(toolHandle);
}
```

**Recovery:**
- LLM should see error and try different approach
- May indicate config mismatch (tool removed from agent)

---

### E2002: Tool Validation Failed

**Trigger:** Invalid parameters passed to tool

**Examples:**
- Missing required `orderId`
- `amount` is string instead of number
- `reason` not in enum

**Handling:**
```typescript
if (param.required && !(param.name in params)) {
  return ToolError.validationFailed(toolHandle, param.name, 'Required field missing');
}
if (param.type === 'number' && typeof value !== 'number') {
  return ToolError.validationFailed(toolHandle, param.name, 'Expected number');
}
```

**Recovery:**
- LLM sees error, fixes params, retries
- Max 5 retry iterations per message

---

### E2003: Tool Execution Failed

**Trigger:** API returns error response

**Examples:**
- Order not found in Shopify
- Subscription already cancelled
- Insufficient permissions

**Handling:**
```typescript
if (!response.ok) {
  const errData = await response.json();
  return ToolError.executionFailed(toolHandle, errData.message || errData.error);
}
```

**Recovery:**
- LLM sees error message, can inform customer
- May try alternative approach or escalate

---

### E2004: Tool Timeout

**Trigger:** Tool call exceeds 30s timeout

**Symptoms:**
- AbortError caught
- Returns `{ success: false, error: "Tool call timed out" }`

**Handling:**
```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);

try {
  await fetch(url, { signal: controller.signal });
} catch (error) {
  if (error.name === 'AbortError') {
    return ToolError.timeout(toolHandle, 30000);
  }
}
```

**Recovery:**
- Retry once
- If persists, inform customer of delay
- Consider escalating for critical operations

---

### E2005: Tool Rate Limited

**Trigger:** Shopify/Skio API rate limits exceeded

**Symptoms:**
- HTTP 429 response
- `Retry-After` header present

**Handling:**
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  return ToolError.rateLimited(toolHandle, retryAfter);
}
```

**Recovery:**
- Exponential backoff
- Inform customer of temporary delay
- Queue critical operations

---

### E2006: Tool Network Error

**Trigger:** DNS failure, connection refused, etc.

**Handling:**
```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ToolError.networkError(toolHandle, error.message);
  }
  throw error;
}
```

**Recovery:**
- Retry with backoff
- Check API_URL configuration
- Escalate if persistent

---

## 3. Routing Edge Cases

### E3001: No Agent Found

**Trigger:** Intent doesn't match any routing rule

**Handling:**
```typescript
let targetAgent = this.fallbackAgent; // Always have fallback
```

**Recovery:**
- Automatic: uses general-support-agent
- Logs warning for config review

---

### E3002: Invalid/Ambiguous Intent

**Trigger:** Message can't be classified

**Examples:**
- Single word: "Help"
- Gibberish or typos
- Multiple conflicting intents

**Handling:**
```typescript
if (intent.confidence < 0.3) {
  tracer.traceError(sessionId, 'Low confidence intent classification');
  // Use fallback agent
}
```

**Recovery:**
- Fallback agent asks clarifying question
- Records ambiguity for model improvement

---

### E3003: Routing Loop Detected

**Trigger:** Agent switches back and forth repeatedly

**Detection:**
```typescript
const recentAgents = session.context.previousAgents.slice(-4);
const uniqueCount = new Set(recentAgents).size;
if (recentAgents.length >= 4 && uniqueCount <= 2) {
  throw RoutingError.loopDetected(sessionId, recentAgents);
}
```

**Recovery:**
- Escalate to human
- Complex issue requiring human judgment

---

### E3004: Low Confidence Routing

**Trigger:** Best routing score below threshold

**Handling:**
```typescript
if (highestScore < 0.3) {
  // Ask for clarification instead of guessing
  return {
    targetAgent: this.fallbackAgent,
    intent,
    confidence: highestScore,
    needsClarification: true
  };
}
```

**Recovery:**
- Agent asks customer to rephrase
- More specific question yields better routing

---

## 4. Escalation Edge Cases

### E4001: Already Escalated

**Trigger:** Trying to escalate already-escalated session

**Handling:**
```typescript
if (session.context.escalated) {
  return { escalated: true, reason: session.context.escalationReason };
}
```

**Recovery:**
- No action needed
- Human agent already notified

---

### E4002: Escalation Summary Failed

**Trigger:** Error building escalation summary

**Handling:**
```typescript
try {
  const summary = this.buildEscalationSummary(session);
} catch (e) {
  // Continue with minimal summary
  const summary = { session_id: session.id, error: 'Summary generation failed' };
}
```

**Recovery:**
- Escalation proceeds with minimal context
- Human agent can view full conversation

---

### Escalation Triggers Summary

| Trigger | Detection | Priority |
|---------|-----------|----------|
| Explicit request | Keywords: "human", "manager", "supervisor" | Immediate |
| Trigger phrases | "speak to", "talk to", "transfer to" | Immediate |
| Complex issue | 3+ unique intents in history | Auto |
| Multiple tool failures | 2+ failed tool calls | Safety |
| Sentiment | Extreme frustration detected | Safety |

---

## 5. Validation Edge Cases

### E5001: Missing Required Field

**Trigger:** API request missing required field

**Examples:**
- `POST /session/start` without `customerEmail`
- `POST /session/:id/message` without `message`

**Handling:**
```typescript
if (!body.customerEmail) {
  throw ValidationError.missingField('customerEmail', 'request body');
}
```

**Recovery:**
- Return 400 with clear error message
- Include expected field in response

---

### E5002: Invalid Type

**Trigger:** Field has wrong type

**Handling:**
```typescript
if (typeof body.message !== 'string') {
  throw ValidationError.invalidType('message', 'string', typeof body.message);
}
```

**Recovery:**
- Return 400 with type expectation
- Client fixes and retries

---

### E5003: Invalid Format

**Trigger:** Field has wrong format

**Examples:**
- Email without @
- Order ID with special characters
- Date in wrong format

**Handling:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw ValidationError.invalidFormat('email', 'user@domain.com');
}
```

**Recovery:**
- Return 400 with format example
- Client corrects and retries

---

## 6. LLM Edge Cases

### E6001: API Key Missing

**Trigger:** No LLM API key configured

**Detection:**
```typescript
if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY && !GOOGLE_API_KEY) {
  throw LLMError.apiKeyMissing();
}
```

**Recovery:**
- Server cannot start
- Ops must configure environment variable

---

### E6002: LLM Request Failed

**Trigger:** API returns error

**Examples:**
- Invalid API key
- Model overloaded
- Invalid request format

**Handling:**
```typescript
if (!response.ok) {
  const error = await response.json();
  throw LLMError.requestFailed('Anthropic', error.message);
}
```

**Recovery:**
- Retry with exponential backoff
- Fall back to alternative provider if configured
- Escalate if persistent

---

### E6003: Invalid LLM Response

**Trigger:** Response doesn't match expected format

**Examples:**
- No content in response
- Malformed tool_use block
- Missing required fields

**Handling:**
```typescript
if (!response.content || response.content.length === 0) {
  throw LLMError.responseInvalid('Empty response content');
}
```

**Recovery:**
- Retry (usually transient)
- Use fallback response if available

---

### E6004: LLM Rate Limited

**Trigger:** Too many requests

**Handling:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  throw LLMError.rateLimited(parseInt(retryAfter));
}
```

**Recovery:**
- Queue request
- Implement request throttling
- Inform customer of delay

---

### E6005: Context Too Long

**Trigger:** Conversation exceeds model context window

**Detection:**
```typescript
const tokenCount = estimateTokens(messages);
if (tokenCount > MAX_CONTEXT_TOKENS) {
  throw LLMError.contextTooLong(tokenCount, MAX_CONTEXT_TOKENS);
}
```

**Recovery:**
- Truncate old messages
- Summarize conversation history
- Start fresh context with key info

---

### E6006: Tool Call Parse Failed

**Trigger:** LLM produces malformed tool call

**Examples:**
- Invalid JSON in arguments
- Missing tool name
- Wrong parameter types

**Handling:**
```typescript
try {
  const args = JSON.parse(toolCall.function.arguments);
} catch (e) {
  throw LLMError.toolParseFailed(toolCall.function.arguments);
}
```

**Recovery:**
- Retry (LLM usually corrects)
- Ask LLM to reformat
- Skip tool call and continue

---

## 7. Configuration Edge Cases

### E7001: Invalid Config

**Trigger:** MAS config validation fails

**Examples:**
- Missing required agent
- Empty tools array
- Invalid routing rules

**Handling:**
```typescript
const errors = validateMASConfig(config);
if (errors.length > 0) {
  throw ConfigError.invalid(errors.join('; '));
}
```

**Recovery:**
- Fix config file
- Restart server

---

### E7002: Agent Not Found

**Trigger:** Routing references non-existent agent

**Handling:**
```typescript
const agent = this.agents.get(agentId);
if (!agent) {
  throw ConfigError.agentNotFound(agentId);
}
```

**Recovery:**
- Add missing agent to config
- Fix routing rule targetAgent

---

### E7003: Tool Not Mapped

**Trigger:** Agent tries to use unmapped tool

**Handling:**
```typescript
if (!agent.tools.includes(toolHandle)) {
  throw ConfigError.toolNotMapped(toolHandle, agent.id);
}
```

**Recovery:**
- Add tool to agent's tools array
- Or remove tool call from agent behavior

---

## 8. Storage Edge Cases

### E8001: Read Failed

**Trigger:** Cannot read sessions.json

**Examples:**
- File permissions
- Disk failure
- File locked

**Handling:**
```typescript
try {
  const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
} catch (e) {
  console.error('[Memory] Read failed:', e);
  // Continue with empty sessions
}
```

**Recovery:**
- Logs warning
- Continues with in-memory only
- Data loss on restart

---

### E8002: Write Failed

**Trigger:** Cannot write sessions.json

**Handling:**
```typescript
try {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data));
} catch (e) {
  console.error('[Memory] Write failed:', e);
  // Continue - data in memory
}
```

**Recovery:**
- Logs error
- Continues operating
- Risk of data loss

---

### E8003: Storage Corrupted

**Trigger:** JSON parse fails on sessions.json

**Handling:**
```typescript
try {
  JSON.parse(data);
} catch (e) {
  throw StorageError.corrupted(SESSIONS_FILE);
}
```

**Recovery:**
- Delete corrupted file
- Start fresh
- Data is lost

---

## Dashboard Edge Cases

### No Sessions

**Trigger:** Fresh start or after reset

**UI:**
- Shows "No active sessions" message
- "New" button prominent

---

### Session Deleted Mid-View

**Trigger:** Session deleted while viewing

**Handling:**
```javascript
if (!data.success || !data.trace) {
  // Clear current view
  messages.value = [];
  trace.value = [];
}
```

---

### Network Disconnection

**Trigger:** API unreachable

**UI:**
- Red connection indicator
- Operations fail with alert

**Handling:**
```javascript
catch { connected.value = false; }
```

---

### Large Conversation

**Trigger:** 100+ messages in session

**Current:** Renders all (may lag)

**Improvement:** Virtual scrolling needed

---

### Concurrent Updates

**Trigger:** Multiple browsers editing same session

**Current:** Last write wins

**Improvement:** Add optimistic locking

---

## Recovery Strategies Summary

| Error Type | Strategy | Fallback |
|------------|----------|----------|
| Session | Start new | Re-authenticate |
| Tool | Retry → Inform → Escalate | Manual action |
| Routing | Fallback agent | Escalate |
| LLM | Retry → Fallback provider | Escalate |
| Config | Fix and restart | N/A |
| Storage | Log and continue | Memory-only |

---

## Testing Edge Cases

```bash
# Session not found
curl -X POST localhost:3001/session/invalid/message \
  -d '{"message":"test"}' -H "Content-Type: application/json"

# Empty message
curl -X POST localhost:3001/session/start \
  -d '{}' -H "Content-Type: application/json"

# Escalation trigger
curl -X POST localhost:3001/session/{id}/message \
  -d '{"message":"I want to speak to a human"}' -H "Content-Type: application/json"

# Tool timeout (simulated)
# Requires mock API with delayed responses
```

---

## Monitoring Checklist

- [ ] Error rate by code (E1xxx, E2xxx, etc.)
- [ ] Escalation rate and reasons
- [ ] Tool failure rate per tool
- [ ] LLM latency and error rate
- [ ] Session duration distribution
- [ ] Routing confidence distribution
