export type FoundingCircleMailtoFields = {
  email: string;
  lens: string;
  contribution: string;
  concern: string;
};

export function buildFoundingCircleMailto(fields: FoundingCircleMailtoFields): string {
  const subject = encodeURIComponent('Founding circle interest');
  const body = encodeURIComponent(
    [
      'I am interested in the Karmyq founding circle.',
      '',
      `Email: ${fields.email.trim()}`,
      `Lens: ${fields.lens.trim()}`,
      `What I can contribute: ${fields.contribution.trim()}`,
      `What I want to pressure-test: ${fields.concern.trim()}`,
    ].join('\n')
  );

  return `mailto:contact@karmyq.org?subject=${subject}&body=${body}`;
}
