const reg = require('../../scripts/gotcha-registry.js');

describe('gotcha registry — credential screening', () => {
  it('passes ordinary prose', () => {
    expect(reg.scanCredentials('Diagnose the endpoint with a direct probe.', 'a.md')).toEqual([]);
  });

  it('FLAGS a password assignment', () => {
    expect(reg.scanCredentials('password: hunter2seventeen', 'a.md')).toEqual([
      expect.stringContaining('a.md'),
    ]);
  });

  it('FLAGS a private key block', () => {
    expect(reg.scanCredentials('-----BEGIN OPENSSH PRIVATE KEY-----', 'a.md')).toEqual([
      expect.stringContaining('a.md'),
    ]);
  });

  it('FLAGS a postgres connection string with credentials', () => {
    expect(
      reg.scanCredentials('postgresql://karmyq_prod:s3cr3tvalue@karmyq.com:5432/db', 'a.md'),
    ).toEqual([expect.stringContaining('a.md')]);
  });

  it('FLAGS a bearer token', () => {
    expect(reg.scanCredentials('Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'a.md'))
      .toEqual([expect.stringContaining('a.md')]);
  });

  // High recall is the safer failure direction here: a false positive costs a
  // rewording, a false negative publishes a secret irreversibly.
  it('does not flag the word "password" used descriptively', () => {
    expect(reg.scanCredentials('The runbook explains where the password is stored.', 'a.md')).toEqual([]);
  });
});
