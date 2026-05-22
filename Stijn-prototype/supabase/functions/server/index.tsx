import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-ca63c5ab/health", (c) => {
  return c.json({ status: "ok" });
});

// Get all session data (tokens, clusters, events)
app.get("/make-server-ca63c5ab/session", async (c) => {
  try {
    const tokens = await kv.get("tokens") || [];
    const clusters = await kv.get("clusters") || [];
    const events = await kv.get("events") || [];
    return c.json({ tokens, clusters, events });
  } catch (error) {
    console.log(`Error fetching session data: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Add a new token
app.post("/make-server-ca63c5ab/tokens", async (c) => {
  try {
    const { text, position, description } = await c.req.json();
    const tokens = await kv.get("tokens") || [];
    const newToken = {
      id: `token-${Date.now()}-${Math.random()}`,
      text,
      description: description || '',
      clusterId: null,
      position,
      createdAt: new Date().toISOString()
    };
    tokens.push(newToken);
    await kv.set("tokens", tokens);

    // Add event
    const events = await kv.get("events") || [];
    events.unshift({
      id: `event-${Date.now()}-${Math.random()}`,
      type: 'created',
      message: `New token "${text}" created`,
      timestamp: new Date().toISOString()
    });
    await kv.set("events", events.slice(0, 100));

    return c.json(newToken);
  } catch (error) {
    console.log(`Error creating token: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Update token position
app.put("/make-server-ca63c5ab/tokens/:id/position", async (c) => {
  try {
    const { id } = c.req.param();
    const { position } = await c.req.json();
    const tokens = await kv.get("tokens") || [];
    const tokenIndex = tokens.findIndex((t: any) => t.id === id);
    if (tokenIndex === -1) {
      return c.json({ error: "Token not found" }, 404);
    }
    tokens[tokenIndex].position = position;
    await kv.set("tokens", tokens);
    return c.json(tokens[tokenIndex]);
  } catch (error) {
    console.log(`Error updating token position: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Update token text
app.put("/make-server-ca63c5ab/tokens/:id/text", async (c) => {
  try {
    const { id } = c.req.param();
    const { text } = await c.req.json();
    const tokens = await kv.get("tokens") || [];
    const tokenIndex = tokens.findIndex((t: any) => t.id === id);
    if (tokenIndex === -1) {
      return c.json({ error: "Token not found" }, 404);
    }
    tokens[tokenIndex].text = text;
    await kv.set("tokens", tokens);
    return c.json(tokens[tokenIndex]);
  } catch (error) {
    console.log(`Error updating token text: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Update token description
app.put("/make-server-ca63c5ab/tokens/:id/description", async (c) => {
  try {
    const { id } = c.req.param();
    const { description } = await c.req.json();
    const tokens = await kv.get("tokens") || [];
    const tokenIndex = tokens.findIndex((t: any) => t.id === id);
    if (tokenIndex === -1) {
      return c.json({ error: "Token not found" }, 404);
    }
    tokens[tokenIndex].description = description;
    await kv.set("tokens", tokens);
    return c.json(tokens[tokenIndex]);
  } catch (error) {
    console.log(`Error updating token description: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Delete token
app.delete("/make-server-ca63c5ab/tokens/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const tokens = await kv.get("tokens") || [];
    const clusters = await kv.get("clusters") || [];

    const tokenIndex = tokens.findIndex((t: any) => t.id === id);
    if (tokenIndex === -1) {
      return c.json({ error: "Token not found" }, 404);
    }

    const token = tokens[tokenIndex];

    // Remove token from tokens array
    tokens.splice(tokenIndex, 1);
    await kv.set("tokens", tokens);

    // Remove from cluster if it was in one
    if (token.clusterId) {
      const cluster = clusters.find((c: any) => c.id === token.clusterId);
      if (cluster) {
        cluster.tokenIds = cluster.tokenIds.filter((tid: string) => tid !== id);
        await kv.set("clusters", clusters);
      }
    }

    // Add event
    const events = await kv.get("events") || [];
    events.unshift({
      id: `event-${Date.now()}-${Math.random()}`,
      type: 'moved',
      message: `Token "${token.text}" deleted`,
      timestamp: new Date().toISOString()
    });
    await kv.set("events", events.slice(0, 100));

    return c.json({ success: true, id });
  } catch (error) {
    console.log(`Error deleting token: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Clear all tokens
app.delete("/make-server-ca63c5ab/clear-all", async (c) => {
  try {
    // Clear all tokens and clusters
    await kv.set("tokens", []);
    await kv.set("clusters", []);

    // Add event
    const events = await kv.get("events") || [];
    events.unshift({
      id: `event-${Date.now()}-${Math.random()}`,
      type: 'moved',
      message: `All tokens cleared`,
      timestamp: new Date().toISOString()
    });
    await kv.set("events", events.slice(0, 100));

    return c.json({ success: true, message: "All tokens cleared" });
  } catch (error) {
    console.log(`Error clearing all tokens: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Add token to cluster
app.put("/make-server-ca63c5ab/tokens/:id/cluster", async (c) => {
  try {
    const { id } = c.req.param();
    const { clusterId } = await c.req.json();
    const tokens = await kv.get("tokens") || [];
    const clusters = await kv.get("clusters") || [];

    const tokenIndex = tokens.findIndex((t: any) => t.id === id);
    if (tokenIndex === -1) {
      return c.json({ error: "Token not found" }, 404);
    }

    const oldClusterId = tokens[tokenIndex].clusterId;
    tokens[tokenIndex].clusterId = clusterId;

    // Update cluster token lists
    if (oldClusterId) {
      const oldCluster = clusters.find((c: any) => c.id === oldClusterId);
      if (oldCluster) {
        oldCluster.tokenIds = oldCluster.tokenIds.filter((tid: string) => tid !== id);
      }
    }

    if (clusterId) {
      const newCluster = clusters.find((c: any) => c.id === clusterId);
      if (newCluster && !newCluster.tokenIds.includes(id)) {
        newCluster.tokenIds.push(id);
      }

      // Add event
      const events = await kv.get("events") || [];
      events.unshift({
        id: `event-${Date.now()}-${Math.random()}`,
        type: 'moved',
        message: `Token "${tokens[tokenIndex].text}" added to "${newCluster?.name}"`,
        timestamp: new Date().toISOString()
      });
      await kv.set("events", events.slice(0, 100));
    }

    await kv.set("tokens", tokens);
    await kv.set("clusters", clusters);
    return c.json(tokens[tokenIndex]);
  } catch (error) {
    console.log(`Error updating token cluster: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Create a new cluster
app.post("/make-server-ca63c5ab/clusters", async (c) => {
  try {
    const { name, tokenIds } = await c.req.json();
    const clusters = await kv.get("clusters") || [];
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6b7280'];
    const newCluster = {
      id: `cluster-${Date.now()}`,
      name,
      tokenIds: tokenIds || [],
      color: colors[clusters.length % colors.length]
    };
    clusters.push(newCluster);
    await kv.set("clusters", clusters);

    // Update tokens if tokenIds provided
    if (tokenIds && tokenIds.length > 0) {
      const tokens = await kv.get("tokens") || [];
      tokenIds.forEach((tid: string) => {
        const token = tokens.find((t: any) => t.id === tid);
        if (token) token.clusterId = newCluster.id;
      });
      await kv.set("tokens", tokens);

      // Add event
      const events = await kv.get("events") || [];
      events.unshift({
        id: `event-${Date.now()}-${Math.random()}`,
        type: 'clustered',
        message: `${tokenIds.length} tokens clustered into "${name}"`,
        timestamp: new Date().toISOString()
      });
      await kv.set("events", events.slice(0, 100));
    }

    return c.json(newCluster);
  } catch (error) {
    console.log(`Error creating cluster: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

// Add event (for suggestions)
app.post("/make-server-ca63c5ab/events", async (c) => {
  try {
    const { type, message } = await c.req.json();
    const events = await kv.get("events") || [];
    const newEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date().toISOString()
    };
    events.unshift(newEvent);
    await kv.set("events", events.slice(0, 100));
    return c.json(newEvent);
  } catch (error) {
    console.log(`Error creating event: ${error}`);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);