import { buildFoundingCircleMailto } from '../../src/lib/buildSubscribeMailto';

describe('founding-circle mailto builder', () => {
  test('encodes every user-provided field in the exact href', () => {
    const href = buildFoundingCircleMailto({
      email: ' ravi+launch@example.com ',
      lens: 'Civic technologist & organizer',
      contribution: 'UX review + service design / “hard questions”',
      concern: 'Can this avoid surveillance? <script>alert(1)</script>',
    });

    expect(href).toBe(
      'mailto:contact@karmyq.org?subject=Founding%20circle%20interest&body=I%20am%20interested%20in%20the%20Karmyq%20founding%20circle.%0A%0AEmail%3A%20ravi%2Blaunch%40example.com%0ALens%3A%20Civic%20technologist%20%26%20organizer%0AWhat%20I%20can%20contribute%3A%20UX%20review%20%2B%20service%20design%20%2F%20%E2%80%9Chard%20questions%E2%80%9D%0AWhat%20I%20want%20to%20pressure-test%3A%20Can%20this%20avoid%20surveillance%3F%20%3Cscript%3Ealert(1)%3C%2Fscript%3E'
    );
  });
});
