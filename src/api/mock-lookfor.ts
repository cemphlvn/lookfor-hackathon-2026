/**
 * Mock Lookfor API — For demo/testing when backend routes not available
 *
 * This simulates the expected Lookfor API responses.
 * Use only for demos. Set USE_MOCK_API=true to enable.
 */

import http from 'http';

interface MockOrder {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  trackingUrl: string | null;
  items: { title: string; quantity: number }[];
}

interface MockSubscription {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextBillingDate: string;
  email: string;
}

// Mock data store - supports both NP-prefixed and simple numeric order IDs
const mockOrders: MockOrder[] = [
  {
    id: 'gid://shopify/Order/1001',
    name: '#1001',
    createdAt: '2026-02-01T10:00:00Z',
    status: 'DELIVERED',
    trackingUrl: 'https://tracking.example.com/abc123',
    items: [{ title: 'NATPAT Sleep Patches', quantity: 2 }]
  },
  {
    id: 'gid://shopify/Order/1002',
    name: '#1002',
    createdAt: '2026-02-05T14:30:00Z',
    status: 'FULFILLED',
    trackingUrl: 'https://tracking.example.com/xyz789',
    items: [{ title: 'NATPAT Calm Patches', quantity: 1 }]
  },
  {
    id: 'gid://shopify/Order/1003',
    name: '#1003',
    createdAt: '2026-02-07T09:00:00Z',
    status: 'UNFULFILLED',
    trackingUrl: null,
    items: [{ title: 'NATPAT Focus Patches', quantity: 3 }]
  },
  {
    id: 'gid://shopify/Order/NP1234567',
    name: '#NP1234567',
    createdAt: '2026-02-01T10:00:00Z',
    status: 'FULFILLED',
    trackingUrl: 'https://track.ups.com/123456',
    items: [{ title: 'NATPAT Sleep Patches', quantity: 2 }]
  }
];

const mockSubscriptions: MockSubscription[] = [
  {
    id: 'sub_001',
    status: 'ACTIVE',
    nextBillingDate: '2026-02-15',
    email: 'customer@example.com'
  }
];

// Route handlers
const handlers: Record<string, (params: Record<string, unknown>) => { success: boolean; data?: unknown; error?: string }> = {
  '/hackhaton/get_customer_orders': (params) => {
    const email = params.email as string;
    const limit = (params.limit as number) || 10;
    return {
      success: true,
      data: {
        orders: mockOrders.slice(0, limit),
        hasNextPage: false,
        endCursor: null
      }
    };
  },

  '/hackhaton/get_order_details': (params) => {
    const orderId = (params.orderId as string || '').replace('#', '').toUpperCase();
    // Match by name (without #), id suffix, or exact name match
    const order = mockOrders.find(o =>
      o.name.replace('#', '').toUpperCase() === orderId ||
      o.id.toUpperCase().includes(orderId) ||
      o.name === params.orderId
    );
    if (order) {
      return { success: true, data: order };
    }
    console.log(`[MockAPI] Order not found: ${orderId} (available: ${mockOrders.map(o => o.name).join(', ')})`);
    return { success: false, error: `Order ${params.orderId} not found` };
  },

  '/hackhaton/cancel_order': (params) => {
    return { success: true, data: { cancelled: true, orderId: params.orderId } };
  },

  '/hackhaton/refund_order': (params) => {
    return { success: true, data: { refunded: true, orderId: params.orderId } };
  },

  '/hackhaton/create_return': (params) => {
    return { success: true, data: { returnId: `return_${Date.now()}`, orderId: params.orderId } };
  },

  '/hackhaton/update_order_shipping_address': (params) => {
    return { success: true, data: { updated: true, orderId: params.orderId } };
  },

  '/hackhaton/create_discount_code': (params) => {
    const code = `DISCOUNT_LF_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return { success: true, data: { code } };
  },

  '/hackhaton/create_store_credit': (params) => {
    return {
      success: true,
      data: {
        storeCreditAccountId: `gid://shopify/StoreCreditAccount/${Date.now()}`,
        credited: params.creditAmount,
        newBalance: params.creditAmount
      }
    };
  },

  '/hackhaton/add_tags': (params) => {
    return { success: true, data: { added: params.tags } };
  },

  '/hackhaton/get_product_details': (params) => {
    return {
      success: true,
      data: [{
        id: 'gid://shopify/Product/1',
        title: 'NATPAT Sleep Patches',
        handle: 'natpat-sleep-patches',
        description: 'Natural sleep patches for kids'
      }]
    };
  },

  '/hackhaton/get_product_recommendations': (params) => {
    return {
      success: true,
      data: [
        { id: 'gid://shopify/Product/1', title: 'NATPAT Sleep Patches', handle: 'sleep-patches' },
        { id: 'gid://shopify/Product/2', title: 'NATPAT Calm Patches', handle: 'calm-patches' }
      ]
    };
  },

  '/hackhaton/get_collection_recommendations': (params) => {
    return {
      success: true,
      data: [
        { id: 'gid://shopify/Collection/1', title: 'Sleep Collection', handle: 'sleep' },
        { id: 'gid://shopify/Collection/2', title: 'Wellness Collection', handle: 'wellness' }
      ]
    };
  },

  '/hackhaton/get_related_knowledge_source': (params) => {
    return {
      success: true,
      data: {
        faqs: [
          { question: 'How do I use the patches?', answer: 'Apply to clean, dry skin 30 minutes before bedtime.' }
        ],
        pdfs: [],
        blogArticles: [],
        pages: []
      }
    };
  },

  // Skio endpoints
  '/hackhaton/get-subscription-status': (params) => {
    const email = params.email as string;
    const sub = mockSubscriptions.find(s => s.email === email) || mockSubscriptions[0];
    return {
      success: true,
      data: {
        status: sub.status,
        subscriptionId: sub.id,
        nextBillingDate: sub.nextBillingDate
      }
    };
  },

  '/hackhaton/cancel-subscription': (params) => {
    return { success: true, data: { cancelled: true, subscriptionId: params.subscriptionId } };
  },

  '/hackhaton/pause-subscription': (params) => {
    return { success: true, data: { paused: true, pausedUntil: params.pausedUntil } };
  },

  '/hackhaton/skip-next-order-subscription': (params) => {
    return { success: true, data: { skipped: true, subscriptionId: params.subscriptionId } };
  },

  '/hackhaton/unpause-subscription': (params) => {
    return { success: true, data: { unpaused: true, subscriptionId: params.subscriptionId } };
  }
};

export function createMockServer(port: number = 3001): http.Server {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Extract path (remove /v1/api prefix if present)
    let path = req.url || '/';
    if (path.startsWith('/v1/api')) {
      path = path.replace('/v1/api', '');
    }

    console.log(`[MockAPI] ${req.method} ${path}`);

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return;
    }

    const handler = handlers[path];
    if (!handler) {
      console.log(`[MockAPI] Route not found: ${path}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Route not found: ${path}` }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const result = handler(params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(`[MockAPI] Error:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
    });
  });

  server.listen(port, () => {
    console.log(`[MockAPI] Mock Lookfor API running on http://localhost:${port}`);
    console.log(`[MockAPI] Set API_URL=http://localhost:${port}/v1/api to use`);
  });

  return server;
}

// To run standalone: npx tsx scripts/start-mock-api.ts
