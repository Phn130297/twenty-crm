// GraphQL Client for Twenty CRM API
import axios from 'axios';

export class TwentyGraphQLClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = 'http://localhost:3001', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await axios.post(
      `${this.baseUrl}/graphql`,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0]?.message || 'GraphQL error');
    }

    return response.data.data;
  }

  // Contact operations
  async createContact(name: string, email?: string, phone?: string, tags?: string[]) {
    const tagIds = tags?.map(t => ({ name: t }));
    return this.query(`
      mutation CreateContact($name: String!, $email: String, $phone: String, $tags: [TagCreateInput]) {
        createPerson(data: { name: $name, email: $email, phone: $phone, tagIds: $tags }) {
          id
          name
          email
          phone
        }
      }
    `, { name, email, phone, tags: tagIds });
  }
  async getContacts(limit = 50) {
    const filter = '{ name: { $not: { $eq: "" } } }';
    return this.query(`
      query GetContacts($limit: Int!) {
        people(limit: $limit, filter: ${filter}) {
          id
          name
          email
          phone
          createdAt
        }
      }
    `, { limit });
  }

  // Deal operations
  async createDeal(name: string, amount: number, stageId?: string) {
    return this.query(`
      mutation CreateDeal($name: String!, $amount: Float!) {
        createOpportunity(data: { name: $name, amount: $amount }) {
          id
          name
          amount
        }
      }
    `, { name, amount });
  }

  // Order operations (using Opportunities as order proxy)
  async createOrder(name: string, amount: number, contactId?: string) {
    return this.query(`
      mutation CreateOrder($name: String!, $amount: Float!, $contactId: UUID) {
        createOpportunity(data: { name: $name, amount: $amount, personId: $contactId }) {
          id
          name
          amount
        }
      }
    `, { name, amount, contactId });
  }

  async getOrders(limit = 50) {
    return this.query(`
      query GetOrders($limit: Int!) {
        opportunities(limit: $limit, orderBy: { createdAt: DESC }) {
          id
          name
          amount
          stage {
            id
            name
          }
          person {
            id
            name
          }
          createdAt
        }
      }
    `, { limit });
  }

  // Product operations
  async createProduct(name: string, price?: number, description?: string) {
    return this.query(`
      mutation CreateProduct($name: String!, $price: Float, $description: String) {
        createProduct(data: { name: $name, price: $price, description: $description }) {
          id
          name
          price
        }
      }
    `, { name, price, description });
  }

  async getProducts(limit = 50) {
    return this.query(`
      query GetProducts($limit: Int!) {
        products(limit: $limit) {
          id
          name
          price
          description
        }
      }
    `, { limit });
  }

  async getDeals(limit = 20) {
    return this.query(`
      query GetDeals($limit: Int!) {
        opportunities(limit: $limit) {
          id
          name
          amount
          stage
          createdAt
        }
      }
    `, { limit });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/healthz`);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const graphqlClient = new TwentyGraphQLClient(
  process.env.TWENTY_API_URL || 'http://localhost:3001',
  process.env.TWENTY_API_KEY
);
