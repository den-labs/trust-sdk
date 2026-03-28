import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { TrustClient } from '@denlabs/trust-client-core'

// --- Oracle registry ---

const ORACLES: Record<string, { name: string; baseUrl: string; chains: Record<string, number> }> = {
  denscope: {
    name: 'DenScope',
    baseUrl: 'https://denscope.vercel.app',
    chains: { celo: 42220, 'celo-sepolia': 11142220, 'skale-base': 1187947933 },
  },
  ayni: {
    name: 'Ayni',
    baseUrl: 'https://ayni-alpha.vercel.app',
    chains: { avalanche: 43114, fuji: 43113 },
  },
}

function resolveOracle(oracle: string): (typeof ORACLES)[string] {
  const key = oracle.toLowerCase()
  const entry = ORACLES[key]
  if (!entry) throw new Error(`Unknown oracle "${oracle}". Available: ${Object.keys(ORACLES).join(', ')}`)
  return entry
}

function resolveChainId(oracle: (typeof ORACLES)[string], chain: string | number): number {
  if (typeof chain === 'number') return chain
  const num = Number(chain)
  if (!isNaN(num)) return num
  const id = oracle.chains[chain.toLowerCase()]
  if (!id) throw new Error(`Unknown chain "${chain}" for ${oracle.name}. Available: ${Object.keys(oracle.chains).join(', ')}`)
  return id
}

function createClient(oracle: (typeof ORACLES)[string], apiKey?: string): TrustClient {
  if (apiKey) {
    return new TrustClient({ apiKey }, oracle.baseUrl)
  }
  // Without API key, some endpoints still work (getAgent, getEvents, search)
  // For score/signals, the server will return an auth error
  return new TrustClient({ apiKey: '' }, oracle.baseUrl)
}

function interpretScore(value: number, confidence: string): string {
  let level = 'unknown'
  if (value >= 80) level = 'high trust'
  else if (value >= 50) level = 'moderate trust'
  else if (value >= 25) level = 'low trust'
  else level = 'minimal data'

  return `${value}/100 (${level}, ${confidence} confidence)`
}

// --- MCP Server ---

const server = new Server(
  {
    name: 'trust-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'trust_get_score',
      description: 'Get the trust score for an ERC-8004 agent. Returns a 0-100 score with confidence level, breakdown, and human-readable interpretation. Use this to check if an agent is trustworthy before interacting with it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle to query: "denscope" (Celo, SKALE Base) or "ayni" (Avalanche)', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID (e.g. "celo", "skale-base", "fuji", 42220, 1187947933)' },
          agentId: { type: 'number', description: 'Agent ID (numeric)' },
          apiKey: { type: 'string', description: 'API key (ds_xxx). Optional for some endpoints.' },
        },
        required: ['oracle', 'chain', 'agentId'],
      },
    },
    {
      name: 'trust_get_agent',
      description: 'Get the profile of an ERC-8004 agent including owner address, metadata, feedback counts, and claim status. Does not require API key.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle: "denscope" (Celo, SKALE Base) or "ayni" (Avalanche)', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID' },
          agentId: { type: 'number', description: 'Agent ID' },
          apiKey: { type: 'string', description: 'API key (optional)' },
        },
        required: ['oracle', 'chain', 'agentId'],
      },
    },
    {
      name: 'trust_get_signals',
      description: 'Get risk signals and incidents for an ERC-8004 agent. Signals include reputation drops, sybil clusters, feedback spikes. Use this to understand WHY an agent has its current trust score.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle: "denscope" or "ayni"', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID' },
          agentId: { type: 'number', description: 'Agent ID' },
          status: { type: 'string', description: 'Filter by status', enum: ['open', 'resolved', 'all'] },
          apiKey: { type: 'string', description: 'API key (required for this endpoint)' },
        },
        required: ['oracle', 'chain', 'agentId'],
      },
    },
    {
      name: 'trust_search_agents',
      description: 'Search for ERC-8004 agents by chain, owner address, or query string. Returns a list of agents with basic info. Does not require API key.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle: "denscope" or "ayni"', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID (optional filter)' },
          query: { type: 'string', description: 'Search query (agent ID, owner address)' },
          limit: { type: 'number', description: 'Max results (default 10)' },
          apiKey: { type: 'string', description: 'API key (optional)' },
        },
        required: ['oracle'],
      },
    },
    {
      name: 'trust_get_events',
      description: 'Get on-chain event history for an ERC-8004 agent. Includes registrations, feedback events, URI updates, and validations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle: "denscope" or "ayni"', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID' },
          agentId: { type: 'number', description: 'Agent ID' },
          limit: { type: 'number', description: 'Max events (default 10)' },
          apiKey: { type: 'string', description: 'API key (optional)' },
        },
        required: ['oracle', 'chain', 'agentId'],
      },
    },
  ],
}))

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const oracleKey = (args?.oracle as string) ?? 'denscope'
    const oracle = resolveOracle(oracleKey)
    const apiKey = (args?.apiKey as string) || process.env.DENSCOPE_API_KEY || process.env.AYNI_API_KEY
    const client = createClient(oracle, apiKey || undefined)

    switch (name) {
      case 'trust_get_score': {
        const chainId = resolveChainId(oracle, args?.chain as string)
        const agentId = args?.agentId as number
        const { score } = await client.getScore(chainId, agentId)
        const interpretation = interpretScore(score.value, score.confidence)

        return {
          content: [{
            type: 'text',
            text: [
              `Trust Score for Agent #${agentId} on ${oracle.name} (chain ${chainId}):`,
              ``,
              `  Score: ${interpretation}`,
              `  Confidence: ${score.confidence}`,
              ``,
              `  Breakdown:`,
              `    Positive Ratio: ${(score.breakdown.positiveRatio.value * 100).toFixed(1)}% (weight: ${score.breakdown.positiveRatio.weight})`,
              `    Age Score: ${(score.breakdown.ageScore.value * 100).toFixed(1)}% (weight: ${score.breakdown.ageScore.weight})`,
              `    Activity: ${(score.breakdown.activityScore.value * 100).toFixed(1)}% (weight: ${score.breakdown.activityScore.weight})`,
              `    Incident Penalty: ${(score.breakdown.incidentPenalty.value * 100).toFixed(1)}% (weight: ${score.breakdown.incidentPenalty.weight})`,
              ``,
              `  Stats:`,
              `    Feedback: ${score.stats.feedbackCount} total (${score.stats.positiveCount}+ / ${score.stats.negativeCount}-)`,
              `    Open Incidents: ${score.stats.openIncidents}`,
              `    Updated: ${score.updatedAt}`,
            ].join('\n'),
          }],
        }
      }

      case 'trust_get_agent': {
        const chainId = resolveChainId(oracle, args?.chain as string)
        const agentId = args?.agentId as number
        const { agent } = await client.getAgent(chainId, agentId)

        return {
          content: [{
            type: 'text',
            text: [
              `Agent #${agentId} on ${oracle.name} (chain ${chainId}):`,
              ``,
              `  Name: ${agent.displayName ?? agent.uri ?? 'Unknown'}`,
              `  Owner: ${agent.owner}`,
              `  Claimed: ${agent.claimed ? 'Yes' : 'No'}${agent.claimedBy ? ` by ${agent.claimedBy}` : ''}`,
              `  Feedback: ${agent.feedbackCount} total (${agent.positiveCount}+ / ${agent.negativeCount}-)`,
              `  First seen: ${agent.firstSeen}`,
              `  Last seen: ${agent.lastSeen}`,
              agent.uri ? `  URI: ${agent.uri}` : '',
            ].filter(Boolean).join('\n'),
          }],
        }
      }

      case 'trust_get_signals': {
        const chainId = resolveChainId(oracle, args?.chain as string)
        const agentId = args?.agentId as number
        const status = (args?.status as 'open' | 'resolved' | 'all') ?? undefined
        const { signals, count } = await client.getSignals(chainId, agentId, status ? { status } : undefined)

        if (count === 0) {
          return {
            content: [{
              type: 'text',
              text: `No signals found for Agent #${agentId} on ${oracle.name} (chain ${chainId}).`,
            }],
          }
        }

        const lines = signals.map((s) =>
          `  [${s.severity.toUpperCase()}] ${s.title} (${s.signalKind}) — ${s.description}${s.resolvedAt ? ' [RESOLVED]' : ''}`
        )

        return {
          content: [{
            type: 'text',
            text: [
              `${count} signal(s) for Agent #${agentId} on ${oracle.name}:`,
              '',
              ...lines,
            ].join('\n'),
          }],
        }
      }

      case 'trust_search_agents': {
        const chainId = args?.chain ? resolveChainId(oracle, args.chain as string) : undefined
        const q = args?.query as string | undefined
        const limit = (args?.limit as number) ?? 10
        const { agents, count } = await client.search({ chainId, q, limit })

        if (count === 0) {
          return {
            content: [{
              type: 'text',
              text: `No agents found on ${oracle.name}${chainId ? ` (chain ${chainId})` : ''}.`,
            }],
          }
        }

        const lines = agents.map((a) =>
          `  #${a.agentId} — owner: ${a.owner.slice(0, 10)}... | feedback: ${a.feedbackCount} (${a.positiveCount}+ / ${a.negativeCount}-)`
        )

        return {
          content: [{
            type: 'text',
            text: [
              `Found ${count} agent(s) on ${oracle.name}:`,
              '',
              ...lines,
            ].join('\n'),
          }],
        }
      }

      case 'trust_get_events': {
        const chainId = resolveChainId(oracle, args?.chain as string)
        const agentId = args?.agentId as number
        const limit = (args?.limit as number) ?? 10
        const { events, pagination } = await client.getEvents(chainId, agentId, { limit })

        if (events.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No events found for Agent #${agentId} on ${oracle.name} (chain ${chainId}).`,
            }],
          }
        }

        const lines = events.map((e) =>
          `  [${e.kind}] block ${e.blockNumber} — tx ${e.txHash.slice(0, 14)}... (${e.eventTimestamp ?? e.createdAt})`
        )

        return {
          content: [{
            type: 'text',
            text: [
              `${pagination.total} event(s) for Agent #${agentId} (showing ${events.length}):`,
              '',
              ...lines,
              pagination.hasMore ? `\n  ... and ${pagination.total - events.length} more` : '',
            ].filter(Boolean).join('\n'),
          }],
        }
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
  }
})

// Start
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
