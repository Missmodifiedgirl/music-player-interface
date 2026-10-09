import React, { useState } from 'react';
import { backendApi } from '../backend-api.js';

function AccountView({ ui, user, initialError, accountMode }) {
  const [mode, setMode] = useState(accountMode);
  const [error, setError] = useState(initialError || '');
  const [pending, setPending] = useState(false);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    ui.accountMode = nextMode;
    ui.localAccountError = '';
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name?.value.trim() || '';
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmation = form.elements['password-confirm']?.value;

    if (mode === 'signup' && password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const result = mode === 'signup'
        ? await backendApi.signup(name, email, password)
        : await backendApi.login(email, password);
      ui.localUser = result.user;
      ui.localAccountError = '';
      ui.renderLocalAccountStatus();
      ui.renderAccountView();
      ui.showToast(mode === 'signup' ? 'Account created.' : 'Welcome back.', 'success');
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    setPending(true);
    try {
      await backendApi.logout();
      ui.localUser = null;
      ui.accountMode = 'login';
      ui.renderLocalAccountStatus();
      ui.renderAccountView();
      ui.showToast('You have logged out.', 'info');
    } catch (requestError) {
      setError(requestError.message || 'Could not log out.');
    } finally {
      setPending(false);
    }
  };

  if (user) {
    const name = user.name || user.username || user.email?.split('@')[0] || 'Account';
    return (
      <section className="account-view animate-fade-in">
        <div className="account-intro">
          <span className="account-eyebrow">MUSIC PLAYER / ACCOUNT</span>
          <h1 className="account-heading">Welcome, {name}.</h1>
          <p className="account-description">Your website account is separate from Spotify. Your playlists remain in this browser.</p>
        </div>
        <div className="account-panel">
          <span className="account-panel-label">SIGNED IN</span>
          <h2 className="account-user-email">{name}</h2>
          <p className="account-helper account-email">{user.email}</p>
          <p className="account-helper">Connect Spotify separately to search and play its catalog.</p>
          <button className="btn btn-secondary account-submit" type="button" onClick={logout} disabled={pending}>Log out</button>
          {error && <p className="account-form-message is-error" role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  const signingUp = mode === 'signup';

  return (
    <section className="account-view animate-fade-in">
      <div className="account-intro">
        <span className="account-eyebrow">MUSIC PLAYER / ACCOUNT</span>
        <h1 className="account-heading">Your music, your space.</h1>
        <p className="account-description">Create a website account to manage your profile. Your playlists remain in this browser.</p>
      </div>
      <div className="account-panel">
        <div className="account-mode-switch" role="tablist" aria-label="Account access">
          <button className={`account-mode-tab ${!signingUp ? 'active' : ''}`} type="button" role="tab" aria-selected={!signingUp} onClick={() => changeMode('login')}>Log in</button>
          <button className={`account-mode-tab ${signingUp ? 'active' : ''}`} type="button" role="tab" aria-selected={signingUp} onClick={() => changeMode('signup')}>Create account</button>
        </div>
        <h2 className="account-form-title">{signingUp ? 'Create your account' : 'Welcome back'}</h2>
        <p className="account-helper">{signingUp ? 'Use your email to get started.' : 'Log in with your website account.'}</p>
        <form className="account-auth-form" onSubmit={submit}>
          {signingUp && (
            <label className="account-field">
              <span>Your name</span>
              <input className="input-field" name="name" type="text" autoComplete="name" maxLength={150} required />
            </label>
          )}
          <label className="account-field">
            <span>Email address</span>
            <input className="input-field" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="account-field">
            <span>Password</span>
            <input className="input-field" name="password" type="password" autoComplete={signingUp ? 'new-password' : 'current-password'} minLength={6} required />
          </label>
          {signingUp && (
            <label className="account-field">
              <span>Confirm password</span>
              <input className="input-field" name="password-confirm" type="password" autoComplete="new-password" minLength={6} required />
            </label>
          )}
          <p className={`account-form-message ${error ? 'is-error' : ''}`} role="status">{error}</p>
          <button className="btn btn-primary account-submit" type="submit" disabled={pending}>
            {pending ? 'Please wait…' : signingUp ? 'Create account' : 'Log in'}
          </button>
        </form>
        <p className="account-helper account-separation-note">Website account only. Spotify connection is managed separately.</p>
      </div>
    </section>
  );
}

export default AccountView;