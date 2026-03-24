// lib/mockAuth.ts
/**
 * Mock Authentication for Offline Mode
 * Provides a fake session when VITE_USE_LOCAL_DATA=true
 */

export interface MockSession {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
    };
  };
  access_token: string;
}

class MockAuthManager {
  private sessionKey = 'mock_session_offline';

  /**
   * Create a mock session for offline development
   */
  public createMockSession(email: string = 'dev@localhost'): MockSession {
    const session: MockSession = {
      user: {
        id: 'mock-user-' + Date.now(),
        email: email,
        user_metadata: {
          name: 'Dev User'
        }
      },
      access_token: 'mock-token-' + Date.now()
    };

    // Save to localStorage
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return session;
  }

  /**
   * Get stored mock session
   */
  public getMockSession(): MockSession | null {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear mock session
   */
  public clearMockSession(): void {
    localStorage.removeItem(this.sessionKey);
  }

  /**
   * Check if mock session exists
   */
  public hasMockSession(): boolean {
    return this.getMockSession() !== null;
  }
}

export const mockAuthManager = new MockAuthManager();
