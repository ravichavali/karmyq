/**
 * Admin authentication utility
 *
 * Checks if current user has admin role in any community
 * Used to protect admin UI pages
 */

export interface User {
  id: string;
  email: string;
  communities?: Array<{
    id: string;
    role: 'admin' | 'moderator' | 'member';
    name: string;
  }>;
}

/**
 * Check if current user is authenticated
 * Returns true if token exists in localStorage
 */
export function isAuthenticated(): boolean {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token !== null;
}

/**
 * Check if current user has admin role in any community
 * Returns true if user is admin of at least one community
 */
export function isAdmin(): boolean {
  if (typeof window === 'undefined') return false;

  const userData = localStorage.getItem('user');
  if (!userData) return false;

  try {
    const user: User = JSON.parse(userData);
    // Check if user has admin role in at least one community
    return user.communities?.some((c) => c.role === 'admin') || false;
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return false;
  }
}

/**
 * Get current user from localStorage
 * Returns null if not authenticated
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined' || !isAuthenticated()) return null;

  const userData = localStorage.getItem('user');
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return null;
  }
}

/**
 * Redirect to login if not authenticated
 * Used in useEffect hooks
 */
export function requireAuth(router: any): boolean {
  if (!isAuthenticated()) {
    router.push('/login');
    return false;
  }
  return true;
}

/**
 * Redirect to login if not admin
 * Used in useEffect hooks to protect admin pages
 */
export function requireAdmin(router: any): boolean {
  if (!isAuthenticated()) {
    router.push('/login');
    return false;
  }

  if (!isAdmin()) {
    router.push('/dashboard');
    return false;
  }

  return true;
}
