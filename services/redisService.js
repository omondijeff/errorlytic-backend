const Redis = require("ioredis");

class RedisService {
  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.client.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    this.client.on("error", (error) => {
      console.error("❌ Redis connection error:", error);
    });
  }

  /**
   * Set a key-value pair with optional expiry
   * @param {string} key - Redis key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error("❌ Redis SET error:", error);
      return false;
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Redis key
   * @returns {Promise<any>} Stored value or null
   */
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("❌ Redis GET error:", error);
      return null;
    }
  }

  /**
   * Delete a key
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error("❌ Redis DEL error:", error);
      return false;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} Key existence
   */
  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error("❌ Redis EXISTS error:", error);
      return false;
    }
  }

  /**
   * Set expiry for a key
   * @param {string} key - Redis key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl) {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error("❌ Redis EXPIRE error:", error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Redis key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error("❌ Redis TTL error:", error);
      return -2;
    }
  }

  /**
   * Increment a numeric value
   * @param {string} key - Redis key
   * @param {number} increment - Increment value (default: 1)
   * @returns {Promise<number>} New value
   */
  async incr(key, increment = 1) {
    try {
      if (increment === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, increment);
      }
    } catch (error) {
      console.error("❌ Redis INCR error:", error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   * @param {string} key - Redis key
   * @param {number} decrement - Decrement value (default: 1)
   * @returns {Promise<number>} New value
   */
  async decr(key, decrement = 1) {
    try {
      if (decrement === 1) {
        return await this.client.decr(key);
      } else {
        return await this.client.decrby(key, decrement);
      }
    } catch (error) {
      console.error("❌ Redis DECR error:", error);
      return 0;
    }
  }

  /**
   * Add item to a list
   * @param {string} key - Redis key
   * @param {any} value - Value to add
   * @returns {Promise<number>} New list length
   */
  async lpush(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      return await this.client.lpush(key, serializedValue);
    } catch (error) {
      console.error("❌ Redis LPUSH error:", error);
      return 0;
    }
  }

  /**
   * Remove and return item from list
   * @param {string} key - Redis key
   * @returns {Promise<any>} Removed item or null
   */
  async rpop(key) {
    try {
      const value = await this.client.rpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("❌ Redis RPOP error:", error);
      return null;
    }
  }

  /**
   * Get list length
   * @param {string} key - Redis key
   * @returns {Promise<number>} List length
   */
  async llen(key) {
    try {
      return await this.client.llen(key);
    } catch (error) {
      console.error("❌ Redis LLEN error:", error);
      return 0;
    }
  }

  /**
   * Add to a set
   * @param {string} key - Redis key
   * @param {any} member - Member to add
   * @returns {Promise<number>} Number of elements added
   */
  async sadd(key, member) {
    try {
      const serializedMember = JSON.stringify(member);
      return await this.client.sadd(key, serializedMember);
    } catch (error) {
      console.error("❌ Redis SADD error:", error);
      return 0;
    }
  }

  /**
   * Check if member exists in set
   * @param {string} key - Redis key
   * @param {any} member - Member to check
   * @returns {Promise<boolean>} Member existence
   */
  async sismember(key, member) {
    try {
      const serializedMember = JSON.stringify(member);
      const result = await this.client.sismember(key, serializedMember);
      return result === 1;
    } catch (error) {
      console.error("❌ Redis SISMEMBER error:", error);
      return false;
    }
  }

  /**
   * Get all members of a set
   * @param {string} key - Redis key
   * @returns {Promise<Array>} Set members
   */
  async smembers(key) {
    try {
      const members = await this.client.smembers(key);
      return members.map((member) => JSON.parse(member));
    } catch (error) {
      console.error("❌ Redis SMEMBERS error:", error);
      return [];
    }
  }

  /**
   * Cache API response with automatic key generation
   * @param {string} prefix - Cache key prefix
   * @param {Object} params - Parameters for key generation
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async cacheApiResponse(prefix, params, data, ttl = 3600) {
    const key = `${prefix}:${JSON.stringify(params)}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached API response
   * @param {string} prefix - Cache key prefix
   * @param {Object} params - Parameters for key generation
   * @returns {Promise<any>} Cached data or null
   */
  async getCachedApiResponse(prefix, params) {
    const key = `${prefix}:${JSON.stringify(params)}`;
    return await this.get(key);
  }

  /**
   * Rate limiting helper
   * @param {string} key - Rate limit key (e.g., user ID, IP)
   * @param {number} limit - Request limit
   * @param {number} window - Time window in seconds
   * @returns {Promise<Object>} Rate limit status
   */
  async rateLimit(key, limit, window) {
    const rateLimitKey = `rate_limit:${key}`;
    const current = await this.incr(rateLimitKey);

    if (current === 1) {
      await this.expire(rateLimitKey, window);
    }

    return {
      allowed: current <= limit,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      resetTime: Date.now() + (await this.ttl(rateLimitKey)) * 1000,
    };
  }

  /**
   * Get Redis connection status
   * @returns {Promise<boolean>} Connection status
   */
  async isConnected() {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      await this.client.quit();
      console.log("✅ Redis connection closed");
    } catch (error) {
      console.error("❌ Error closing Redis connection:", error);
    }
  }
}

module.exports = new RedisService();
