/**
 * The constraints, stated plainly. A page that only lists strengths is one an
 * operator stops trusting the moment they hit the first gap after installing,
 * and these are the gaps people actually hit.
 */
export const limits: Array<{ claim: string; detail: string }> = [
  {
    claim: 'It is not a hosted service.',
    detail:
      'There is no VPSGUI cloud and no account. You clone the repository onto your own server and run it, and the only thing that talks to your machine is the agent you installed on it.',
  },
  {
    claim: 'It has no user accounts.',
    detail:
      'No database of users, no roles, no permissions. The sign-in screen is a local profile gate stored in your own browser. Real access control is the agent token plus whatever you put in front of the UI.',
  },
  {
    claim: 'It is not a monitoring stack.',
    detail:
      'Readings are live. Nothing is retained as a time series, so there are no historical graphs, no alert rules and no paging. Keep Prometheus if you need those.',
  },
  {
    claim: 'It is not an SSH client.',
    detail:
      'The terminal runs commands through the agent over HTTP, not over SSH. That means no interactive programs, no port forwarding and no key-based session — it is command in, output back.',
  },
  {
    claim: 'It has not been through a third-party audit.',
    detail:
      'The security model is written out in full and the source is short enough to read, which is the honest substitute. Decide accordingly before exposing it.',
  },
];
