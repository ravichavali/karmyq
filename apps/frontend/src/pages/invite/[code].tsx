import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { api, socialGraphService } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface InvitationInfo {
  inviter_name: string;
  community_name: string;
  community_id: string;
}

/**
 * Sprint 118 (ADR-085) — invitation is the celebrated join path. This page IS the landing: the
 * inviter and community are the context, and account creation happens inside it. Success hands the
 * invitation-bond context to the /welcome arrival moment via sessionStorage (`karmyq_arrival`) —
 * the bond is provenance from the funnel, never a manufactured trust edge.
 */
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

    // Same registration side effects as register.tsx: token, refreshToken, user, auth header.
    const persistSession = (data: { token: string; refreshToken?: string; user: unknown }) => {
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    };

    try {
      // Register the user
      const registerResponse = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      persistSession(registerResponse.data);
      // Clear any leftover read-only demo state when registering a real account.
      localStorage.removeItem('demoContext');

      // Accept the invitation, then refresh the session so the JWT carries the new membership.
      try {
        const acceptResponse = await socialGraphService.acceptInvitationCode(invitationCode);
        const inviterId = acceptResponse?.data?.inviter_id;

        // Re-login to get updated JWT with community memberships
        const loginResponse = await api.post('/auth/login', {
          email: formData.email,
          password: formData.password,
        });
        persistSession(loginResponse.data);

        // Hand the invitation-bond context to the arrival moment (stamped with the account it
        // belongs to — /welcome drops a context left behind by another login on this tab).
        sessionStorage.setItem(
          'karmyq_arrival',
          JSON.stringify({
            path: 'invite',
            userId: loginResponse.data.user?.id,
            inviterId,
            inviterName: invitationInfo?.inviter_name,
            communityId: invitationInfo?.community_id,
            communityName: invitationInfo?.community_name,
          })
        );

        router.push('/welcome');
        return;
      } catch (acceptErr) {
        console.error('Failed to accept invitation or refresh session', { error: acceptErr instanceof Error ? acceptErr.message : String(acceptErr) });
        // Don't fail the signup if invitation acceptance fails — the account exists; land them on
        // the open discovery path instead of a broken arrival.
        router.push('/communities?welcome=true');
        return;
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Registration failed'));
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

  // The landing: the invitation IS the page — community + inviter context first, account form inside.
  return (
    <>
      <Head>
        <title>Join {invitationInfo?.community_name || 'Karmyq'}</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full">
          {/* Context hero — who is bringing you in, and to where */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl font-semibold">
              {invitationInfo?.inviter_name?.charAt(0).toUpperCase() || '✦'}
            </div>
            <h1 className="text-3xl font-bold font-serif text-text mb-2">
              <span className="text-primary">{invitationInfo?.inviter_name}</span> invited you to
              join <span className="text-accent">{invitationInfo?.community_name}</span>
            </h1>
            <p className="text-text-muted">
              A community of neighbours who help each other. Your invitation is where your story
              here begins.
            </p>
          </div>

          <div className="bg-surface-raised rounded-xl shadow-lg border border-border p-8">
            <h2 className="text-lg font-semibold text-text mb-1">Create your account</h2>
            <p className="text-sm text-text-muted mb-6">
              You&apos;ll arrive in {invitationInfo?.community_name} with{' '}
              {invitationInfo?.inviter_name} at your side.
            </p>

            {error && (
              <div className="bg-error-light border border-error/20 text-error px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="invite-name" className="block text-sm font-medium text-text mb-2">
                  Full Name
                </label>
                <input
                  id="invite-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-text mb-2">
                  Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="invite-password" className="block text-sm font-medium text-text mb-2">
                  Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="invite-confirm-password" className="block text-sm font-medium text-text mb-2">
                  Confirm Password
                </label>
                <input
                  id="invite-confirm-password"
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
                {loading ? 'Creating Account...' : `Join ${invitationInfo?.community_name || 'the community'}`}
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
      </div>
    </>
  );
}
