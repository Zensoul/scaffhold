// Versioned consent text. When this wording changes, increment the
// version string and NEVER edit past versions — old consent records
// reference the version they agreed to (StudentInvite.consentTextVersion),
// and rewriting history here would silently invalidate the audit trail
// the whole point of versioning is to preserve.

export const DPDP_CONSENT_VERSION = 'v1.0'

const CONSENT_TEMPLATE = `By checking this box, I confirm that I am the parent or legal guardian of the child named above, and I consent to Scaffhold collecting and processing my child's personal data — including their responses to practice problems, session activity, and progress over time — for the purpose of providing adaptive math and physics tutoring.

I understand that:
- My child's data will be used only to personalize their learning experience and to share progress updates with me.
- My child's raw written responses are retained for 18 months, after which they are anonymized; aggregated progress data is retained indefinitely.
- I can request a copy of my child's data, or request that it be deleted, at any time by contacting support.
- My child's data will never be used for advertising or shared with third parties for marketing purposes.

I consent on behalf of my child, __CHILD_NAME__, to their use of this platform under these terms.`

export function renderConsentText(childName: string): string {
  return CONSENT_TEMPLATE.replaceAll('__CHILD_NAME__', childName)
}