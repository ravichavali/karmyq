import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { api, socialGraphService } from '@/lib/api';

interface InvitationInfo {
  inviter_name: string;
  community_name: string;
  community_id: string;
}

export default function InviteAcceptance() {
  const router = useRouter();
  const { code } = router.query;

  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate invitation code on mount
  useEffect(() => {
    if (!code || typeof code !== 'string') return;

    const invitationCode = code as string; // Type narrowing

    async function validateCode() {
      setValidating(true);
      setValidationError('');

      try {
        const response = await socialGraphService.validateInvitationCode(invitationCode);
        setInvitationInfo(response.data.data);
      } catch (err: any) {
        setValidationError(
          err.response?.data?.message || 'Invalid or expired invitation code'
        );
      } finally {
        setValidating(false);
      }
    }

    validateCode();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!code || typeof code !== 'string') {
      setError('Invalid invitation code');
      return;
    }

    const invitationCode = code as string; // Type narrowing
    setLoading(true);

    try {
      // Register the user
      const registerResponse = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      const token = registerResponse.data.token;
      const user = registerResponse.data.user;

      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Set token for next request
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Accept the invitation
      try {
        await socialGraphService.acceptInvitationCode(invitationCode);

        // Re-login to get updated JWT with community memberships
        const loginResponse = await api.post('/auth/login', {
          email: formData.email,
          password: formData.password,
        });

        const newToken = loginResponse.data.token;
        const updatedUser = loginResponse.data.user;

        // Update stored token and user with community membership
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      } catch (acceptErr) {
        console.error('Failed to accept invitation or refresh session', { error: acceptErr instanceof Error ? acceptErr.message : String(acceptErr) });
        // Don't fail the signup if invitation acceptance fails
        // User is already registered at this point
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <>
        <Head>
          <title>Join Karmyq</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-muted">Validating invitation...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (validationError) {
    return (
      <>
        <Head>
          <title>Invalid Invitation - Karmyq</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
            <div className="text-center">
              <svg className="w-16 h-16 text-error mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-2xl font-bold text-text mb-2">Invalid Invitation</h1>
              <p className="text-text-muted mb-6">{validationError}</p>
              <Link href="/" className="text-primary hover:underline">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Success state - show signup form
  return (
    <>
      <Head>
        <title>Join {invitationInfo?.community_name || 'Karmyq'}</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
          {/* Invitation Info Banner */}
          <div className="bg-gradient-to-r from-primary-light to-accent-light rounded-lg p-4 mb-6 border border-primary-medium">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <h2 className="text-lg font-semibold text-text">You've been invited!</h2>
            </div>
            <p className="text-sm text-text-muted">
              <span className="font-medium text-primary">{invitationInfo?.inviter_name}</span>
              {' '}has invited you to join{' '}
              <span className="font-medium text-accent">{invitationInfo?.community_name}</span>
            </p>
          </div>

          <h1 className="text-3xl font-bold font-serif text-center mb-2">Create Your Account</h1>
          <p className="text-center text-text-muted mb-8">
            Join the community and start helping others
          </p>

          {error && (
            <div className="bg-error-light border border-error/20 text-error px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:from-primary-dark hover:to-accent-dark transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating Account...' : 'Join Community'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-sm text-text-muted">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>

          <p className="text-center mt-4 text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
