import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { User } from '../types';
import { Session } from '@supabase/supabase-js';

describe('Auth Zustand Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuth.setState({
      user: null,
      session: null,
      isLoading: true,
    });
  });

  it('should have correct initial state', () => {
    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('should update user state with setUser', () => {
    const mockUser: User = {
      id: 'usr-123',
      email: 'test@company.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'EMPLOYEE',
      designation: 'Developer',
    };

    useAuth.getState().setUser(mockUser);
    expect(useAuth.getState().user).toEqual(mockUser);

    useAuth.getState().setUser(null);
    expect(useAuth.getState().user).toBeNull();
  });

  it('should update session state with setSession', () => {
    const mockSession = {
      access_token: 'tok-abc',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'ref-xyz',
      user: { id: 'usr-123', email: 'test@company.com' },
    } as unknown as Session;

    useAuth.getState().setSession(mockSession);
    expect(useAuth.getState().session).toEqual(mockSession);

    useAuth.getState().setSession(null);
    expect(useAuth.getState().session).toBeNull();
  });

  it('should update loading state with setLoading', () => {
    useAuth.getState().setLoading(false);
    expect(useAuth.getState().isLoading).toBe(false);

    useAuth.getState().setLoading(true);
    expect(useAuth.getState().isLoading).toBe(true);
  });
});
