# Open Source and the AGPL

Karmyq's manifesto makes a promise: *"Every line of code is public. Fork it, improve it, make it
yours."* A license is what turns that from a sentiment into something you can rely on.

Karmyq is licensed **AGPL-3.0-or-later** — the GNU Affero General Public License, version 3 or any
later version. The full text lives in [`LICENSE`](https://github.com/ravichavali/karmyq/blob/master/LICENSE)
at the root of the repository.

## What you may do

Everything you would expect from free software, and the license guarantees it rather than merely
permitting it this year:

- **Run it.** For yourself, for a neighbourhood, for a city, commercially or not. No fee, no
  permission, no usage limit.
- **Read it.** All of it. There is no hidden core.
- **Change it.** Fork it and take it somewhere we never imagined.
- **Share it.** Give copies away, or charge for them.

## What you owe in return

One thing, and it is the point of choosing this license: **if you give people your modified Karmyq,
you give them your modifications too** — under the same license.

Under most open-source licenses that obligation stops at distribution. If you never hand anyone a
copy of the software, you never have to hand anyone the source. Running it as a website is not
distribution, so a company can take an MIT-licensed project, improve it privately, run it as a
service for millions of people, and owe nothing back.

The AGPL closes exactly that gap. Its section 13 says that **if people interact with your modified
version over a network, they are entitled to its source code.** That is what separates it from the
permissive alternatives we actually weighed — MIT, Apache-2.0 and BSD — none of which ask anything
of a company running a modified copy as a service. It is not the only license with a network
clause; other copyleft licenses reach network use too. It is the one that fits Karmyq, and the
network-use condition is the whole reason for picking it.

So, concretely:

| If you… | You must… |
|---|---|
| Run Karmyq unmodified, for anyone | Nothing beyond keeping the license and copyright notices |
| Modify it and keep it to yourself | Nothing |
| Modify it and give someone a copy | Offer them your modified source, under AGPL-3.0-or-later |
| **Modify it and run it as a service others use** | **Offer those users your modified source, under AGPL-3.0-or-later** |

You can charge money for any of it. Copyleft is about the source staying available, not about
software being free of charge.

## Why this license and not a simpler one

Karmyq's claim is that *"the infrastructure for cooperation should belong to everyone."* MIT and
Apache-2.0 are excellent licenses, and under either of them that sentence would not have been true:
someone could run a closed, improved Karmyq as a service and the commons would get nothing back.
The manifesto would have described a hope rather than a mechanism.

Network copyleft is the mechanism. It is what makes *"if someone runs Karmyq, their changes stay
open too"* a fact about the license rather than a request.

The `-or-later` part follows the Free Software Foundation's recommendation: if a future AGPLv4
fixes something the current version gets wrong, adopting it does not require tracking down every
past contributor.

## If you are forking

Keep the `LICENSE` file and the copyright notice, license your changes under AGPL-3.0-or-later, and
if you run your fork as a service, make its source available to the people using it. Publishing your
fork on a public host is the easiest way to satisfy that — and it is what makes forks useful to
everyone else rather than only to you.

Beyond that: the project is genuinely yours to take somewhere new. That is what the license is for.

## If you are contributing

`CONTRIBUTING.md` states it directly: contributions are licensed under AGPL-3.0-or-later. There is
no separate contributor agreement and no copyright assignment — your work stays yours, under the
same terms as everyone else's.

---

*This page summarizes the license in plain language. The
[`LICENSE`](https://github.com/ravichavali/karmyq/blob/master/LICENSE) file is the actual legal
terms, and it governs where the two differ. The reasoning behind the choice is recorded in
ADR-092.*
